'use client'

import { useEffect, useState } from 'react'
import { IconBell } from './Icons'

// Browser push opt-in button. Renders nothing where push can't work (Safari
// without an installed PWA, older browsers, or no VAPID key configured) rather
// than showing a control that silently fails.

type State = 'unsupported' | 'idle' | 'busy' | 'on' | 'blocked' | 'error'

/**
 * VAPID keys travel as base64url; PushManager wants raw bytes. Returning the
 * ArrayBuffer rather than the view sidesteps the Uint8Array<ArrayBufferLike>
 * vs BufferSource mismatch in current TS DOM lib types.
 */
function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const buffer = new ArrayBuffer(raw.length)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i += 1) view[i] = raw.charCodeAt(i)
  return buffer
}

export default function PushOptIn() {
  const [state, setState] = useState<State>('idle')
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

  useEffect(() => {
    if (!publicKey || typeof window === 'undefined') {
      setState('unsupported')
      return
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setState('blocked')
      return
    }

    // Reflect an existing subscription so the button doesn't invite a member to
    // turn on something they already have.
    navigator.serviceWorker.getRegistration().then((reg) => {
      reg?.pushManager.getSubscription().then((sub) => {
        if (sub) setState('on')
      })
    })
  }, [publicKey])

  async function subscribe() {
    if (!publicKey) return
    setState('busy')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'blocked' : 'idle')
        return
      }

      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(publicKey),
      })

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription }),
      })
      if (!res.ok) throw new Error('save failed')

      setState('on')
    } catch (err) {
      console.error('Push subscribe failed:', err)
      setState('error')
    }
  }

  if (state === 'unsupported') return null

  if (state === 'on') {
    return (
      <span className="btn btn--outline btn--sm" style={{ cursor: 'default', opacity: 0.75 }}>
        <IconBell size={14} /> Alerts on
      </span>
    )
  }

  if (state === 'blocked') {
    return (
      <span
        className="btn btn--outline btn--sm"
        style={{ cursor: 'default', opacity: 0.6 }}
        title="Notifications are blocked for this site in your browser settings."
      >
        <IconBell size={14} /> Alerts blocked
      </span>
    )
  }

  return (
    <button
      type="button"
      className="btn btn--outline btn--sm"
      onClick={subscribe}
      disabled={state === 'busy'}
    >
      <IconBell size={14} />{' '}
      {state === 'busy' ? 'Enabling…' : state === 'error' ? 'Try again' : 'Notify me'}
    </button>
  )
}
