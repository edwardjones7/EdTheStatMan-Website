'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { trackEvent } from '@/lib/track-client'
import '@/styles/front-door.css'

/**
 * The free-account ask, in one place.
 *
 * The main call to action site-wide is a FREE account (Decisions 2026-10-15),
 * so this is what a logged-out reader meets on content pages. Callers render it
 * only for logged-out visitors; it does not check the session itself, because
 * every page that uses it already knows and a second getUser() per prompt is
 * the round trip the admin-dashboard work spent a week removing.
 *
 * `next` is where the visitor lands after signing up. Defaults to the current
 * path, which is right almost everywhere: they asked from here, so bring them
 * back here.
 *
 * `context` names the placement in the signup_prompt_click event (blog_post,
 * vault_systems, desk_game, ...), so the funnel can say which asks work.
 */

export function signupHref(next: string): string {
  return `/signup?next=${encodeURIComponent(next)}`
}

interface Props {
  context: string
  next?: string
  variant?: 'card' | 'banner'
  title?: ReactNode
  body?: ReactNode
  cta?: string
  /** Extra class for placement spacing at the call site. */
  className?: string
}

export default function SignupPrompt({
  context,
  next,
  variant = 'card',
  title = 'Create a free account',
  body = 'Free picks, the free Vault systems and trends, and an email or push alert when a free pick drops. Google or one email link, no password needed.',
  cta = 'Create a free account',
  className = '',
}: Props) {
  const pathname = usePathname()
  const target = next ?? pathname ?? '/'
  const href = signupHref(target)
  const onClick = () => trackEvent('signup_prompt_click', { context, variant })

  if (variant === 'banner') {
    return (
      <div className={`signup-prompt signup-prompt--banner ${className}`.trim()}>
        <p className="signup-prompt__banner-text">
          <strong>{title}</strong> <span>{body}</span>
        </p>
        <Link href={href} className="btn btn--primary btn--sm signup-prompt__cta" onClick={onClick}>
          {cta} &rarr;
        </Link>
      </div>
    )
  }

  return (
    <div className={`signup-prompt signup-prompt--card ${className}`.trim()}>
      <span className="signup-prompt__eyebrow">Free</span>
      <h2 className="signup-prompt__title">{title}</h2>
      <p className="signup-prompt__body">{body}</p>
      <div className="signup-prompt__actions">
        <Link href={href} className="btn btn--primary signup-prompt__cta" onClick={onClick}>
          {cta} &rarr;
        </Link>
        <Link href={`/login?next=${encodeURIComponent(target)}`} className="signup-prompt__signin">
          Already have one? Sign in
        </Link>
      </div>
    </div>
  )
}

/**
 * A bare "sign up" link that carries the current page as `next` and records
 * the click, for spots where a whole prompt block would be too much (a button
 * row, a lock card). Same event as the block.
 */
export function SignupLink({
  context,
  next,
  className,
  children,
}: {
  context: string
  next?: string
  className?: string
  children: ReactNode
}) {
  const pathname = usePathname()
  return (
    <Link
      href={signupHref(next ?? pathname ?? '/')}
      className={className}
      onClick={() => trackEvent('signup_prompt_click', { context, variant: 'link' })}
    >
      {children}
    </Link>
  )
}
