'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { SignupLink } from './SignupPrompt'
import { TRIAL_DAYS } from '@/lib/offer'
import '@/styles/sticky-signup.css'

/** Pages where the bar would be in the way or pointless. */
const HIDE_ON = [/^\/signup/, /^\/login/, /^\/forgot-password/, /^\/reset-password/, /^\/auth/, /^\/admin/, /^\/account/]
const DISMISS_KEY = 'su_bar_dismissed'

/**
 * A slim signup bar pinned to the bottom of the screen on phones, for
 * signed-out visitors only (the root layout renders it only then).
 *
 * On a phone the right-hand column, where the desktop asks live, ends up far
 * down the page, so most phone visitors never meet an ask at all. The bar
 * waits until they have scrolled a little (reading, not bouncing), and a
 * dismissal holds for the rest of the browser session.
 */
export default function StickySignup() {
  const pathname = usePathname() ?? '/'
  const [show, setShow] = useState(false)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try { setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1') } catch { setDismissed(false) }
    const onScroll = () => setShow(window.scrollY > 320)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (dismissed || HIDE_ON.some(r => r.test(pathname))) return null

  const close = () => {
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch {}
    setDismissed(true)
  }

  return (
    <div className={`sticky-signup${show ? ' is-shown' : ''}`} role="region" aria-label="Create a free account">
      <p className="sticky-signup__text">
        <b>Ed&rsquo;s picks, free for {TRIAL_DAYS} days</b>
        <span>Free account, no card.</span>
      </p>
      <SignupLink context="sticky_bar" className="sticky-signup__cta">Sign up</SignupLink>
      <button type="button" className="sticky-signup__x" onClick={close} aria-label="Dismiss">×</button>
    </div>
  )
}
