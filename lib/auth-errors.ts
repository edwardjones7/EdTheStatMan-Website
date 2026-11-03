/**
 * Auth failures, as short codes in the URL and plain sentences on the page.
 *
 * WHY CODES AND NOT SUPABASE'S TEXT. The pages used to print `?error=` back
 * verbatim, which did two bad things: visitors read strings like "Email rate
 * limit exceeded" or "AuthApiError: ...", and anyone could craft a /signup link
 * whose error box said whatever they liked on our domain. Now only the codes
 * below render; anything else falls through to the generic line.
 *
 * Pure module, no server imports, so the client forms and the server actions
 * share one table.
 */

export type AuthErrorCode =
  | 'auth'          // generic: something went wrong, try again
  | 'email'         // the address does not look like an email
  | 'wait'          // Supabase's per-address resend cooldown (default 60s)
  | 'rate'          // project-wide email send limit, or too many requests
  | 'credentials'   // wrong email or password
  | 'unconfirmed'   // password sign-in before the address was confirmed
  | 'weak'          // password does not meet the rules
  | 'expired'       // the emailed link expired or was already used
  | 'browser'       // emailed link opened in a different browser (PKCE)
  | 'google'        // Google sign-in did not complete
  | 'disabled'      // the provider is switched off in the Supabase dashboard

export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  auth: 'Something went wrong. Please try again.',
  email: 'That email address does not look right. Please check it and try again.',
  wait: 'We just sent you a link. Give it a minute before asking for another.',
  rate: 'We are sending a lot of email right now. Please try again in a few minutes.',
  credentials: 'That email and password do not match. Try again, or get a sign-in link by email instead.',
  unconfirmed: 'This account is not confirmed yet. Use "Email me a link" above and you will be signed in straight away.',
  weak: 'Choose a password with at least 8 characters, an uppercase and a lowercase letter, and a symbol.',
  expired: 'That link has expired or was already used. Enter your email and we will send a fresh one.',
  browser: 'That link was opened in a different browser from the one you asked in. Request a new link here, in this browser, and open it on this device.',
  google: 'Google sign-in did not finish. Please try again.',
  disabled: 'That sign-in method is not available right now. Please try another.',
}

export function isAuthErrorCode(value: unknown): value is AuthErrorCode {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(AUTH_ERROR_MESSAGES, value)
}

/** The sentence for a `?error=` value. Unknown or missing values get the generic line. */
export function authErrorMessage(value: string | null | undefined): string {
  return isAuthErrorCode(value) ? AUTH_ERROR_MESSAGES[value] : AUTH_ERROR_MESSAGES.auth
}

/**
 * Classify a Supabase auth error. Reads the machine `code` first (auth-js
 * exposes it on AuthApiError) and falls back to the message for the older
 * responses that carry none.
 */
export function classifyAuthError(error: { code?: string | null; message?: string | null; status?: number | null } | null | undefined): AuthErrorCode {
  if (!error) return 'auth'
  const code = error.code ?? ''
  const msg = (error.message ?? '').toLowerCase()

  switch (code) {
    case 'email_address_invalid':
    case 'email_address_not_authorized':
    case 'validation_failed':
      return 'email'
    case 'over_email_send_rate_limit':
      // Supabase sends this for BOTH the per-address cooldown and the
      // project-wide hourly cap; the message is the only thing that tells them apart.
      return msg.includes('after') || msg.includes('seconds') ? 'wait' : 'rate'
    case 'over_request_rate_limit':
      return 'rate'
    case 'invalid_credentials':
      return 'credentials'
    case 'email_not_confirmed':
      return 'unconfirmed'
    case 'weak_password':
      return 'weak'
    case 'otp_expired':
    case 'flow_state_expired':
    case 'flow_state_not_found':
      return 'expired'
    case 'pkce_code_verifier_not_found':
    case 'bad_code_verifier':
      return 'browser'
    case 'signup_disabled':
    case 'email_provider_disabled':
    case 'provider_disabled':
    case 'otp_disabled':
      return 'disabled'
  }

  if (msg.includes('for security purposes')) return 'wait'
  if (msg.includes('rate limit')) return 'rate'
  if (msg.includes('invalid login credentials')) return 'credentials'
  if (msg.includes('email not confirmed')) return 'unconfirmed'
  if (msg.includes('code verifier')) return 'browser'
  if (msg.includes('expired') || msg.includes('invalid or has expired')) return 'expired'
  if (msg.includes('invalid') && msg.includes('email')) return 'email'
  if (error.status === 429) return 'rate'
  return 'auth'
}
