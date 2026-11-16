import { SIGNUP_HONEYPOT_FIELD, SIGNUP_TURNSTILE_ACTION } from './signup-fields'
import { verifyTurnstile } from './turnstile'

export { SIGNUP_HONEYPOT_FIELD, SIGNUP_TURNSTILE_ACTION }

const MAX_EMAIL_LENGTH = 254
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface SignupEnv {
    RESEND_API_KEY?: string
    RESEND_FROM?: string
    RESEND_TO?: string
    TURNSTILE_SECRET?: string
    TURNSTILE_HOSTNAMES?: string
}

function json(body: Record<string, unknown>, status: number): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

/**
 * Mailing list signup: verifies Turnstile, then emails the signup to the
 * list owner through Resend. The email is the only record, nothing is stored.
 */
export async function handleSignup(
    request: Request,
    env: SignupEnv,
    fetchImpl: typeof fetch = fetch,
): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response('Method not allowed', {
            status: 405,
            headers: { Allow: 'POST' },
        })
    }

    let form: FormData
    try {
        form = await request.formData()
    } catch {
        return json({ ok: false, error: 'bad request' }, 400)
    }

    // Honeypot: bots fill the hidden field. Pretend success and send nothing.
    if (String(form.get(SIGNUP_HONEYPOT_FIELD) ?? '').trim() !== '') {
        return json({ ok: true }, 200)
    }

    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
    const verified = await verifyTurnstile({
        token: form.get('cf-turnstile-response'),
        secret: env.TURNSTILE_SECRET,
        hostnames: env.TURNSTILE_HOSTNAMES,
        action: SIGNUP_TURNSTILE_ACTION,
        remoteIp: ip,
        fetchImpl,
    })
    if (!verified) return json({ ok: false, error: 'verification failed' }, 403)

    const email = String(form.get('email') ?? '').trim()
    if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
        return json({ ok: false, error: 'invalid email' }, 400)
    }

    if (!env.RESEND_API_KEY || !env.RESEND_TO || !env.RESEND_FROM) {
        // Our own misconfiguration (missing secret or var), not an upstream
        // failure, so 500 rather than 502.
        console.error('signup: missing Resend configuration')
        return json({ ok: false, error: 'server misconfigured' }, 500)
    }

    try {
        const res = await fetchImpl('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: env.RESEND_FROM,
                to: [env.RESEND_TO],
                reply_to: email,
                subject: 'New mailing list signup',
                text: `Add to the mailing list: ${email}\nSubmitted: ${new Date().toISOString()}`,
            }),
        })
        if (!res.ok) {
            console.error('signup: Resend failed', res.status, await res.text())
            return json({ ok: false, error: 'email delivery failed' }, 502)
        }
    } catch (err) {
        console.error('signup: Resend error', err)
        return json({ ok: false, error: 'email delivery failed' }, 502)
    }

    return json({ ok: true }, 200)
}
