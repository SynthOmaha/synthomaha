// Shared between the signup form (client) and the Worker's /api/signup
// handler, so the two cannot drift apart. Keep this module free of server-only
// imports: it ships in the client bundle.
//
// The Resend owner-notification backend is a stopgap. Signups move to a
// Buttondown mailing list (#88); the action and field names stay the same.

/** Turnstile action the widget is rendered with and Siteverify must report. */
export const SIGNUP_TURNSTILE_ACTION = 'signup'

/**
 * Honeypot input name. Deliberately not a name browsers or password managers
 * autofill (such as "company" or "organization"), so real visitors never fill
 * it by accident and get silently dropped.
 */
export const SIGNUP_HONEYPOT_FIELD = 'hp_signup_check'
