/**
 * The origin this deployment should send people back to.
 *
 * WHY THIS IS NOT JUST `process.env.NEXT_PUBLIC_SITE_URL`: that variable is set
 * for Production only, and it is baked at build time. On a preview deployment
 * it is undefined, so every auth redirect fell back to `http://localhost:3000`
 * and Stripe was handed the literal string "undefined/account?success=1". The
 * preview looked fine until you tried to sign in, which is most of the app.
 *
 * Order, and the reason for it:
 *   1. NEXT_PUBLIC_SITE_URL -- the real canonical domain when it is set. Always
 *      correct in Production, and lets anyone override the other two.
 *   2. VERCEL_URL -- the host of THIS deployment, injected by Vercel per build.
 *      Correct automatically on every preview, with nothing to configure and
 *      nothing to update when the URL changes on the next deploy.
 *   3. localhost -- development.
 *
 * SERVER ONLY. VERCEL_URL carries no NEXT_PUBLIC_ prefix, so it does not exist
 * in the browser bundle; calling this from a client component would silently
 * skip step 2. Every current caller is a server action or a route handler.
 *
 * NOTE for Supabase auth: a redirect target must also be on the project's
 * allow-list, so a preview URL needs adding under Auth -> URL Configuration
 * (a `https://*-eddies-projects-a409e902.vercel.app` wildcard covers them all).
 * Without that, Supabase rejects the redirect no matter what this returns.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/$/, '')

  const vercel = process.env.VERCEL_URL
  if (vercel) return `https://${vercel.replace(/\/$/, '')}`

  return 'http://localhost:3000'
}
