'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { safeNext } from '@/lib/safe-redirect'
import { siteUrl } from '@/lib/site-url'
import { checkBotId } from 'botid/server'

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
  const supabase = await createClient()
  const email = formData.get('email') as string

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/reset-password`,
  })

  if (error) {
    redirect(`/forgot-password?error=${encodeURIComponent(error.message)}`)
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

  redirect('/login?message=Password updated successfully. Please sign in.')
}
