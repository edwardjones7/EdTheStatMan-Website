'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { safeNext } from '@/lib/safe-redirect'
import { siteUrl } from '@/lib/site-url'
import { checkBotId } from 'botid/server'
import { headers } from 'next/headers'
import { classifyAuthError, type AuthErrorCode } from '@/lib/auth-errors'
import { recordSignupComplete } from '@/lib/signup-complete'

export type AuthResult = { ok: true } | { ok: false; error: AuthErrorCode }

/**
 * BotID, for every action that makes Supabase SEND MAIL.
 *
 * Same contract as the check in signup() below, and for the same reason (see
 * lib/botid-routes.ts): fails open, because an outage of Vercel's classifier
 * must not take sign-in offline, and is only true on a definite classification.
 * Locally it always returns false.
 *
 * The page each caller is invoked from must be listed in BOTID_PROTECTED, or
 * the browser never attaches the headers and every visitor reads as a bot.
 */
async function isBotRequest(): Promise<boolean> {
  try {
    return (await checkBotId()).isBot
  } catch {
    return false
  }
}

// Deliberately loose. Supabase is the real validator; this only stops an
// obvious typo costing a round trip and an email send attempt.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function readEmail(formData: FormData): string | null {
  const raw = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!raw || raw.length > 254 || !EMAIL_RE.test(raw)) return null
  return raw
}

function passwordOk(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  )
}

/**
 * The emailed link's landing URL. `via` only labels the signup_complete event;
 * the callback ignores anything it does not recognise.
 */
function callbackUrl(next: string, via: 'magic' | 'password'): string {
  return `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}&via=${via}`
}

/**
 * Email a one-time sign-in link. Creates the account if there is none, which
 * is the point: one field, one button, and the click both confirms the address
 * and signs them in, so there is no separate verify-before-use step.
 *
 * Called from /signup, /login, /signup/verify (its resend) and the route
 * /api/free-picks, all of which are in BOTID_PROTECTED because this sends mail
 * to whatever address is typed -- exactly what the September bot was abusing
 * /signup for.
 *
 * Returns a result instead of redirecting so the form can switch to its
 * "check your inbox" state in place and offer a resend.
 *
 * PKCE: the server client stores the code verifier in a cookie on THIS browser,
 * and /auth/callback exchanges the emailed code against it. A link opened in a
 * different browser fails that exchange; the callback says so in plain words.
 */
export async function sendMagicLink(formData: FormData): Promise<AuthResult> {
  if (await isBotRequest()) {
    // Same answer a malformed address gets: detection must not be legible.
    return { ok: false, error: 'auth' }
  }

  const email = readEmail(formData)
  if (!email) return { ok: false, error: 'email' }
  const next = safeNext(formData.get('next') as string, '/')

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl(next, 'magic'),
      shouldCreateUser: true,
    },
  })

  if (error) return { ok: false, error: classifyAuthError(error) }
  return { ok: true }
}

/**
 * Password sign-in, the secondary path. Returns a result so the form can show a
 * friendly line and keep what was typed. Sends no mail, so no BotID.
 */
export async function signInWithPassword(formData: FormData): Promise<AuthResult> {
  const email = readEmail(formData)
  if (!email) return { ok: false, error: 'email' }
  const password = String(formData.get('password') ?? '')
  if (!password) return { ok: false, error: 'credentials' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { ok: false, error: classifyAuthError(error) }

  revalidatePath('/', 'layout')
  return { ok: true }
}

/**
 * Password signup, the secondary path behind "Use a password instead".
 *
 * Works under either setting of the dashboard's "Confirm email" switch: with it
 * on (the default, and today's setting) Supabase returns no session and mails a
 * confirmation link, so this goes to /signup/verify; with it off a session comes
 * straight back, so the account is complete here and this goes to `next`.
 */
export async function signUpWithPassword(formData: FormData): Promise<AuthResult> {
  if (await isBotRequest()) return { ok: false, error: 'auth' }

  const email = readEmail(formData)
  if (!email) return { ok: false, error: 'email' }
  const password = String(formData.get('password') ?? '')
  if (!passwordOk(password)) return { ok: false, error: 'weak' }
  const next = safeNext(formData.get('next') as string, '/')

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: callbackUrl(next, 'password') },
  })
  if (error) return { ok: false, error: classifyAuthError(error) }

  if (data.session && data.user) {
    await recordSignupComplete(data.user, headers(), { via: 'password' })
    revalidatePath('/', 'layout')
    redirect(next)
  }

  redirect(`/signup/verify?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`)
}

export async function login(formData: FormData) {
  const supabase = await createClient()
  const next = safeNext(formData.get('next') as string, '/')

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) {
    redirect(`/login?error=auth&next=${encodeURIComponent(next)}`)
  }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function signup(formData: FormData) {
  // Before anything reaches Supabase, because the abuse this stops is Supabase
  // SENDING MAIL. A bot that gets past here has already made us email whatever
  // address it supplied, and those addresses belong to other people -- see
  // lib/botid-routes.ts for what was actually happening.
  //
  // Fails open by design. checkBotId() is a network call to Vercel, and an
  // outage of it must not take signup down; `isBot` is only ever true on a
  // definite classification. Locally it always returns false.
  //
  // Sent back with the same generic message a bad password gets, deliberately:
  // an operator tuning a bot should not be able to tell detection from
  // validation by reading the response.
  let isBot = false
  try {
    isBot = (await checkBotId()).isBot
  } catch {
    // Explicit, not incidental: if the check itself is unreachable we let the
    // signup through. Never let bot detection be the thing that takes account
    // creation offline.
    isBot = false
  }
  if (isBot) {
    redirect(`/signup?error=auth&next=${encodeURIComponent(safeNext(formData.get('next') as string, '/'))}`)
  }

  const supabase = await createClient()
  const next = safeNext(formData.get('next') as string, '/')

  const password = formData.get('password') as string
  if (
    password.length < 8 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    redirect(`/signup?error=auth&next=${encodeURIComponent(next)}`)
  }

  const { error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  })

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`)
  }

  const email = formData.get('email') as string
  redirect(`/signup/verify?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`)
}

export async function loginWithGoogle() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${siteUrl()}/auth/callback`,
    },
  })

  if (error || !data.url) {
    redirect('/login?error=auth')
  }

  redirect(data.url)
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}

export async function forgotPassword(formData: FormData) {
  // It sends mail to whatever address is typed, like signup does, so it gets
  // the same guard. /forgot-password is in BOTID_PROTECTED for this.
  if (await isBotRequest()) redirect('/forgot-password?error=auth')

  const email = readEmail(formData)
  if (!email) redirect('/forgot-password?error=email')

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/reset-password`,
  })

  if (error) {
    // A code, never Supabase's text: the page renders only known codes.
    redirect(`/forgot-password?error=${classifyAuthError(error)}`)
  }

  redirect('/forgot-password?sent=1')
}

export async function resetPassword(formData: FormData) {
  const supabase = await createClient()
  const password = formData.get('password') as string

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`)
  }

  // A code, not a sentence: /login renders only the messages it knows, so a
  // crafted ?message= link cannot put arbitrary text on our sign-in page.
  redirect('/login?message=password-updated')
}
