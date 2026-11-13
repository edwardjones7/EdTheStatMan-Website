'use client'

import { useEffect, useState } from 'react'
import '@/styles/game-share.css'

/**
 * "Copy line" on a Desk game page: the matchup, spread and total as one line
 * of text ("WSH @ NYG · NYG −1.5 · O/U 40.5") for pasting into a chat. The
 * text is built on the server from the public market; no sportsbook links.
 */
export default function CopyLineButton({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    if (state === 'idle') return
    const t = setTimeout(() => setState('idle'), 2000)
    return () => clearTimeout(t)
  }, [state])

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        // Older browsers and non-secure contexts: a hidden textarea.
        const ta = document.createElement('textarea')
        ta.value = text
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(ta)
        if (!ok) throw new Error('copy failed')
      }
      setState('copied')
    } catch {
      setState('failed')
    }
  }

  return (
    <button
      type="button"
      className={`gs-copy${state === 'copied' ? ' is-copied' : ''}`}
      onClick={copy}
      title={text}
      aria-label={`Copy line: ${text}`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {state === 'copied'
          ? <path d="M5 12.5l4.5 4.5L19 7.5" />
          : <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" /></>}
      </svg>
      <span aria-live="polite">{state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy line'}</span>
    </button>
  )
}
