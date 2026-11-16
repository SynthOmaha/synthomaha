const SITEVERIFY_URL =
    'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const MAX_TOKEN_LENGTH = 2048

export interface VerifyOptions {
    token: unknown
    secret: string | undefined
    /** Comma-separated allowlist of frontend hostnames this deployment serves. */
    hostnames: string | undefined
    action: string
    remoteIp?: string
    fetchImpl?: typeof fetch
}

/**
 * Turnstile Siteverify. Fails closed: a missing secret or hostname allowlist,
 * a bad token, a network or non-2xx or non-JSON Siteverify response, an
 * unsuccessful verdict, a different action, or an unapproved hostname all
 * return false.
 */
export async function verifyTurnstile({
    token,
    secret,
    hostnames,
    action,
    remoteIp,
    fetchImpl = fetch,
}: VerifyOptions): Promise<boolean> {
    const allowed = new Set(
        (hostnames ?? '')
            .split(',')
            .map((hostname) => hostname.trim())
            .filter(Boolean),
    )
    if (
        typeof token !== 'string' ||
        token.length === 0 ||
        token.length > MAX_TOKEN_LENGTH
    ) {
        return false
    }
    if (!secret || allowed.size === 0) return false

    const body = new URLSearchParams({ secret, response: token })
    if (remoteIp && remoteIp !== 'unknown') body.set('remoteip', remoteIp)

    let result: { success?: boolean; action?: string; hostname?: string }
    try {
        const res = await fetchImpl(SITEVERIFY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            signal: AbortSignal.timeout(10_000),
            body,
        })
        if (!res.ok) throw new Error(`siteverify ${res.status}`)
        result = await res.json()
    } catch (err) {
        console.error('turnstile siteverify failed:', err)
        return false
    }

    return (
        result.success === true &&
        result.action === action &&
        allowed.has(result.hostname ?? '')
    )
}
