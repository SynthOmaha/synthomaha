import type { SubmitEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import {
    SIGNUP_HONEYPOT_FIELD,
    SIGNUP_TURNSTILE_ACTION,
    SIGNUP_TURNSTILE_RESPONSE_FIELD,
} from '../lib/signup-fields'

// Set at build time by the Cloudflare build only. When present, the form posts
// to the Worker at /api/signup behind a Turnstile challenge. When absent (the
// Netlify build) it posts to Netlify Forms, as before.
const TURNSTILE_SITE_KEY = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY as
    | string
    | undefined

const TURNSTILE_SRC =
    'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

type TurnstileApi = {
    render: (
        container: HTMLElement,
        options: {
            sitekey: string
            action: string
            callback: (token: string) => void
            'expired-callback': () => void
            'error-callback': () => boolean | undefined
        },
    ) => string
    reset: (widgetId?: string) => void
    remove: (widgetId?: string) => void
}

type TurnstileWindow = Window & { turnstile?: TurnstileApi }

// One load per page, shared by every mount. Listening for 'load' on a script
// tag that already fired it would wait forever, so remounts reuse this promise
// instead of re-attaching listeners.
let turnstileLoad: Promise<TurnstileApi> | undefined

function loadTurnstile(): Promise<TurnstileApi> {
    const w = window as TurnstileWindow
    if (w.turnstile) return Promise.resolve(w.turnstile)
    if (turnstileLoad) return turnstileLoad
    turnstileLoad = new Promise<TurnstileApi>((resolve, reject) => {
        // A tag left over from an earlier failed load never fires again.
        for (const tag of document.querySelectorAll(
            `script[src="${TURNSTILE_SRC}"]`,
        )) {
            tag.remove()
        }
        const script = document.createElement('script')
        script.addEventListener('load', () => {
            if (w.turnstile) resolve(w.turnstile)
            else reject(new Error('turnstile missing'))
        })
        script.addEventListener('error', () =>
            reject(new Error('turnstile failed to load')),
        )
        script.src = TURNSTILE_SRC
        script.async = true
        document.head.appendChild(script)
    }).catch((err: unknown) => {
        // Let a later mount try again.
        turnstileLoad = undefined
        throw err
    })
    return turnstileLoad
}

const CHALLENGE_FAILED =
    'The spam check could not complete. Try again, or reload the page. Privacy extensions can block it.'
const CHALLENGE_LOAD_FAILED =
    'Could not load the spam check. Reload the page and try again. Privacy extensions can block it.'

export default function EmailSignupForm() {
    const [email, setEmail] = useState('')
    const [status, setStatus] = useState<
        'idle' | 'loading' | 'success' | 'error'
    >('idle')
    const [message, setMessage] = useState('')
    const [token, setToken] = useState('')
    // Shown while the Turnstile challenge is failing, so a disabled submit
    // button never sits there without an explanation.
    const [challengeError, setChallengeError] = useState('')
    // Honeypot: real visitors never see or fill this.
    const [honeypot, setHoneypot] = useState('')
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
                    action: SIGNUP_TURNSTILE_ACTION,
                    callback: (next) => {
                        setChallengeError('')
                        setToken(next)
                    },
                    // Turnstile refreshes expired tokens on its own.
                    'expired-callback': () => setToken(''),
                    'error-callback': () => {
                        setToken('')
                        setChallengeError(CHALLENGE_FAILED)
                        // Tells Turnstile the error was handled.
                        return true
                    },
                })
            })
            .catch(() => {
                if (!cancelled) setChallengeError(CHALLENGE_LOAD_FAILED)
            })
        return () => {
            cancelled = true
            const id = widgetId.current
            widgetId.current = undefined
            if (id) (window as TurnstileWindow).turnstile?.remove(id)
        }
    }, [])

    const retryChallenge = () => {
        const w = window as TurnstileWindow
        if (widgetId.current && w.turnstile) {
            setChallengeError('')
            w.turnstile.reset(widgetId.current)
        } else {
            // The script never loaded, so start over.
            window.location.reload()
        }
    }

    const submit = async (): Promise<Response> => {
        if (TURNSTILE_SITE_KEY) {
            return fetch('/api/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    email,
                    [SIGNUP_HONEYPOT_FIELD]: honeypot,
                    [SIGNUP_TURNSTILE_RESPONSE_FIELD]: token,
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
                        name={SIGNUP_HONEYPOT_FIELD}
                        value={honeypot}
                        onChange={(e) => setHoneypot(e.target.value)}
                        tabIndex={-1}
                        autoComplete="off"
                        aria-hidden="true"
                        className="absolute -left-[9999px] h-0 w-0 opacity-0"
                    />
                    <div ref={widgetRef} id="signup-turnstile" />
                    {/* The Turnstile spam check needs JavaScript, so without it
                        the submit button stays disabled. Say why. */}
                    <noscript>
                        <p className="p-3 bg-red-500/20 border border-red-500 rounded text-red-300 text-sm">
                            Signing up needs JavaScript for the spam check. Turn
                            it on and reload the page to subscribe.
                        </p>
                    </noscript>
                    {challengeError && (
                        <div
                            role="alert"
                            className="p-3 bg-red-500/20 border border-red-500 rounded text-red-300 text-sm flex flex-wrap items-center gap-2"
                        >
                            <span>{challengeError}</span>
                            <button
                                type="button"
                                onClick={retryChallenge}
                                className="underline hover:no-underline"
                            >
                                Try again
                            </button>
                        </div>
                    )}
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
