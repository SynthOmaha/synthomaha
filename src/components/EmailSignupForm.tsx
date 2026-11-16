import type { SubmitEvent } from 'react'
import { useEffect, useRef, useState } from 'react'

// Set at build time by the Cloudflare build only. When present, the form posts
// to the Worker at /api/signup behind a Turnstile challenge. When absent (the
// Netlify build) it posts to Netlify Forms, as before.
const TURNSTILE_SITE_KEY = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY as
    | string
    | undefined

const TURNSTILE_SRC =
    'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const TURNSTILE_ACTION = 'signup'

type TurnstileApi = {
    render: (
        container: HTMLElement,
        options: {
            sitekey: string
            action: string
            callback: (token: string) => void
            'expired-callback': () => void
            'error-callback': () => void
        },
    ) => string
    reset: (widgetId?: string) => void
}

type TurnstileWindow = Window & { turnstile?: TurnstileApi }

function loadTurnstile(): Promise<TurnstileApi> {
    const w = window as TurnstileWindow
    if (w.turnstile) return Promise.resolve(w.turnstile)
    return new Promise((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(
            `script[src="${TURNSTILE_SRC}"]`,
        )
        const script = existing ?? document.createElement('script')
        script.addEventListener('load', () => {
            if (w.turnstile) resolve(w.turnstile)
            else reject(new Error('turnstile missing'))
        })
        script.addEventListener('error', () =>
            reject(new Error('turnstile failed to load')),
        )
        if (!existing) {
            script.src = TURNSTILE_SRC
            script.async = true
            document.head.appendChild(script)
        }
    })
}

export default function EmailSignupForm() {
    const [email, setEmail] = useState('')
    const [status, setStatus] = useState<
        'idle' | 'loading' | 'success' | 'error'
    >('idle')
    const [message, setMessage] = useState('')
    const [token, setToken] = useState('')
    // Honeypot: real visitors never see or fill this.
    const [company, setCompany] = useState('')
    const widgetRef = useRef<HTMLDivElement>(null)
    const widgetId = useRef<string | undefined>(undefined)

    useEffect(() => {
        if (!TURNSTILE_SITE_KEY) return
        let cancelled = false
        loadTurnstile()
            .then((turnstile) => {
                if (cancelled || !widgetRef.current || widgetId.current) return
                widgetId.current = turnstile.render(widgetRef.current, {
                    sitekey: TURNSTILE_SITE_KEY,
                    action: TURNSTILE_ACTION,
                    callback: setToken,
                    'expired-callback': () => setToken(''),
                    'error-callback': () => setToken(''),
                })
            })
            .catch(() => {
                if (cancelled) return
                setStatus('error')
                setMessage(
                    'Could not load the spam check. Reload the page and try again.',
                )
            })
        return () => {
            cancelled = true
        }
    }, [])

    const submit = async (): Promise<Response> => {
        if (TURNSTILE_SITE_KEY) {
            return fetch('/api/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    email,
                    company,
                    'cf-turnstile-response': token,
                }).toString(),
            })
        }
        return fetch('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                'form-name': 'signup',
                email,
            }).toString(),
        })
    }

    const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
        e.preventDefault()
        setStatus('loading')

        try {
            const response = await submit()

            if (response.ok) {
                setStatus('success')
                setMessage(
                    'Thanks for signing up! Check your email for updates.',
                )
                setEmail('')
                setTimeout(() => setStatus('idle'), 5000)
            } else {
                setStatus('error')
                setMessage('Something went wrong. Please try again.')
            }
        } catch (_error) {
            setStatus('error')
            setMessage('Failed to subscribe. Please try again.')
        } finally {
            // A Turnstile token is single use.
            if (TURNSTILE_SITE_KEY) {
                setToken('')
                const w = window as TurnstileWindow
                if (widgetId.current) w.turnstile?.reset(widgetId.current)
            }
        }
    }

    const waitingForToken = Boolean(TURNSTILE_SITE_KEY) && !token

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-4"
            id="signup"
            name="signup"
            data-netlify="true"
        >
            <input type="hidden" name="form-name" value="signup" />
            <div>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        type="email"
                        id="email"
                        aria-label="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@synths-rule.biz"
                        required
                        className="field flex-1 max-w-xs"
                    />
                    <button
                        type="submit"
                        disabled={status === 'loading' || waitingForToken}
                        className="self-start px-4 py-2 bg-signal text-signal-content rounded hover:bg-signal/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                        {status === 'loading'
                            ? 'Patching You In...'
                            : 'Patch In (Subscribe to List)'}
                    </button>
                </div>
            </div>

            {TURNSTILE_SITE_KEY && (
                <>
                    <input
                        type="text"
                        name="company"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        tabIndex={-1}
                        autoComplete="off"
                        aria-hidden="true"
                        className="absolute -left-[9999px] h-0 w-0 opacity-0"
                    />
                    <div ref={widgetRef} id="signup-turnstile" />
                </>
            )}

            {status === 'success' && (
                <div className="p-3 bg-green-500/20 border border-green-500 rounded text-green-300 text-sm">
                    {message}
                </div>
            )}

            {status === 'error' && (
                <div className="p-3 bg-red-500/20 border border-red-500 rounded text-red-300 text-sm">
                    {message}
                </div>
            )}
        </form>
    )
}
