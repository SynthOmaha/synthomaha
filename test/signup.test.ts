import { describe, expect, it, vi } from 'vitest'
import {
    handleSignup,
    MAX_SIGNUP_BODY_BYTES,
    SIGNUP_HONEYPOT_FIELD,
    type SignupEnv,
} from '../src/lib/signup'
import worker from '../src/worker'

const env: SignupEnv = {
    RESEND_API_KEY: 're_test',
    RESEND_FROM: 'Synth Omaha <onboarding@resend.dev>',
    RESEND_TO: 'owner@example.com',
    TURNSTILE_SECRET: 'secret',
    TURNSTILE_HOSTNAMES: 'synthnight.com',
}

function signupRequest(fields: Record<string, string>, method = 'POST') {
    const body = new URLSearchParams(fields)
    return new Request('https://synthnight.com/api/signup', {
        method,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: method === 'GET' ? undefined : body,
    })
}

type Verdict = { success: boolean; action?: string; hostname?: string }
const good: Verdict = {
    success: true,
    action: 'signup',
    hostname: 'synthnight.com',
}

/** fetch stub: Siteverify answers `verdict`, Resend answers `resendStatus`. */
function stubFetch(verdict: Verdict = good, resendStatus = 200) {
    return vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input))
        if (url.hostname === 'challenges.cloudflare.com')
            return Response.json(verdict)
        if (url.hostname === 'api.resend.com')
            return new Response('{}', { status: resendStatus })
        throw new Error(`unexpected fetch ${url}`)
    }) as unknown as typeof fetch & ReturnType<typeof vi.fn>
}

const valid = { email: 'fan@example.com', 'cf-turnstile-response': 'tok' }

describe('handleSignup', () => {
    it('rejects non-POST', async () => {
        const res = await handleSignup(
            signupRequest({}, 'GET'),
            env,
            stubFetch(),
        )
        expect(res.status).toBe(405)
    })

    it('pretends success and sends nothing when the honeypot is filled', async () => {
        const f = stubFetch()
        const res = await handleSignup(
            signupRequest({ ...valid, [SIGNUP_HONEYPOT_FIELD]: 'bot inc' }),
            env,
            f,
        )
        expect(res.status).toBe(200)
        expect(f).not.toHaveBeenCalled()
    })

    it('returns 413 for a body over the limit, before calling anything', async () => {
        const f = stubFetch()
        const big = signupRequest({
            ...valid,
            pad: 'x'.repeat(MAX_SIGNUP_BODY_BYTES),
        })
        const res = await handleSignup(big, env, f)
        expect(res.status).toBe(413)
        expect(f).not.toHaveBeenCalled()
    })

    it('returns 413 for an oversized streamed body with no Content-Length', async () => {
        const f = stubFetch()
        const chunk = new TextEncoder().encode('x'.repeat(1024))
        let sent = 0
        const stream = new ReadableStream<Uint8Array>({
            pull(controller) {
                if (sent++ > MAX_SIGNUP_BODY_BYTES / 1024) controller.close()
                else controller.enqueue(chunk)
            },
        })
        const req = new Request('https://synthnight.com/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: stream,
            // @ts-expect-error: duplex is required for streamed bodies in Node
            duplex: 'half',
        })
        expect(req.headers.get('Content-Length')).toBeNull()
        const res = await handleSignup(req, env, f)
        expect(res.status).toBe(413)
        expect(f).not.toHaveBeenCalled()
    })

    it('fails closed when Siteverify answers with non-object JSON', async () => {
        const f = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input))
            if (url.hostname === 'challenges.cloudflare.com')
                return Response.json(null)
            return new Response('{}', { status: 200 })
        }) as unknown as typeof fetch & ReturnType<typeof vi.fn>
        const res = await handleSignup(signupRequest(valid), env, f)
        expect(res.status).toBe(403)
        expect(f).toHaveBeenCalledTimes(1)
    })

    it('rejects a missing token without calling Resend', async () => {
        const f = stubFetch()
        const res = await handleSignup(
            signupRequest({ email: 'fan@example.com' }),
            env,
            f,
        )
        expect(res.status).toBe(403)
        expect(f).not.toHaveBeenCalled()
    })

    it.each([
        ['failed verdict', { success: false }],
        ['wrong action', { ...good, action: 'contact' }],
        ['unapproved hostname', { ...good, hostname: 'evil.example' }],
    ])('rejects %s', async (_name, verdict) => {
        const f = stubFetch(verdict)
        const res = await handleSignup(signupRequest(valid), env, f)
        expect(res.status).toBe(403)
        expect(f).toHaveBeenCalledTimes(1)
    })

    it('fails closed when the secret or hostnames are not configured', async () => {
        const f = stubFetch()
        const noSecret = await handleSignup(
            signupRequest(valid),
            { ...env, TURNSTILE_SECRET: undefined },
            f,
        )
        const noHosts = await handleSignup(
            signupRequest(valid),
            { ...env, TURNSTILE_HOSTNAMES: '' },
            f,
        )
        expect(noSecret.status).toBe(403)
        expect(noHosts.status).toBe(403)
    })

    it('rejects an invalid email', async () => {
        const res = await handleSignup(
            signupRequest({ ...valid, email: 'not-an-email' }),
            env,
            stubFetch(),
        )
        expect(res.status).toBe(400)
    })

    it('returns 502 when Resend fails', async () => {
        const res = await handleSignup(
            signupRequest(valid),
            env,
            stubFetch(good, 500),
        )
        expect(res.status).toBe(502)
    })

    it('returns 500 when Resend is not configured', async () => {
        const res = await handleSignup(
            signupRequest(valid),
            { ...env, RESEND_API_KEY: undefined },
            stubFetch(),
        )
        expect(res.status).toBe(500)
    })

    it('emails the owner with the subscriber as reply-to on success', async () => {
        const f = stubFetch()
        const res = await handleSignup(signupRequest(valid), env, f)
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ ok: true })

        const resendCall = f.mock.calls.find(
            ([u]: [unknown]) =>
                new URL(String(u)).hostname === 'api.resend.com',
        )
        const init = resendCall?.[1] as RequestInit
        expect((init.headers as Record<string, string>).Authorization).toBe(
            'Bearer re_test',
        )
        const sent = JSON.parse(String(init.body))
        expect(sent.to).toEqual(['owner@example.com'])
        expect(sent.reply_to).toBe('fan@example.com')
        expect(sent.text).toContain('fan@example.com')
    })
})

describe('worker routing', () => {
    const assets = {
        fetch: vi.fn(async () => new Response('asset', { status: 200 })),
    }

    it('serves non-API paths from assets', async () => {
        const res = await worker.fetch(
            new Request('https://synthnight.com/events/'),
            { ...env, ASSETS: assets },
        )
        expect(await res.text()).toBe('asset')
    })

    it('404s unknown API paths', async () => {
        const res = await worker.fetch(
            new Request('https://synthnight.com/api/nope'),
            { ...env, ASSETS: assets },
        )
        expect(res.status).toBe(404)
    })

    it('routes /api/signup to the handler', async () => {
        const res = await worker.fetch(
            new Request('https://synthnight.com/api/signup'),
            { ...env, ASSETS: assets },
        )
        expect(res.status).toBe(405)
    })
})
