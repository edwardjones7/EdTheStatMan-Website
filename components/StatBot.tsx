'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { IconBot, IconLock, IconArrowRight } from './Icons'
import { TIER_RANK, type Tier } from '@/lib/access'

// The CSS block is still `.analyst-*` in globals.css. Renaming ~240 lines of
// stylesheet to match the product name would churn a lot for something no user
// ever sees, so the class names stayed when "Desk Analyst" became EdTheStatBot.

interface Props {
  /** null = signed out. The API turns that into a two-tool, IP-capped toolset. */
  tier: Tier | null
  /** Suggestions are tier-specific: never suggest something they can't get. */
  tierLabel: string
}

/**
 * Openers, per rung.
 *
 * These are the honest advertisement for what the bot can do at each level: a
 * suggestion he cannot answer is worse than no suggestion at all, so each list
 * only names things that rung's toolset actually reaches. The guest list is
 * limited to the two anon-safe tools.
 */
const PROMPTS: Record<string, string[]> = {
  guest: [
    'What is EdTheStatMan and what do I actually get?',
    "What's the published record on graded picks?",
  ],
  retail: [
    "What's the difference between the Research Desk and the Vault?",
    'How has the model performed on graded picks?',
  ],
  portfolio: [
    "Walk me through today's picks",
    'How did we do last week?',
  ],
  desk: [
    "What's on the slate this week?",
    "What's in this week's desk note?",
  ],
  private: [
    'Which NFL ATS systems have the best record with at least 50 games?',
    'Show me the strongest home underdog trends',
  ],
  institutional: [
    'NFL ATS systems with 80+ games and a win rate over 58%, grouped by season',
    'Export every NFL system with 100+ games as CSV',
  ],
}

export default function StatBot({ tier, tierLabel }: Props) {
  const [open, setOpen] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [input, setInput] = useState('')
  const [limitHit, setLimitHit] = useState<{ message: string; resetsAt: string; anonymous: boolean } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Where the visitor is, right now. The panel lives in the root layout and
  // never remounts, so this updates on client navigation while the
  // conversation continues -- ask about a system on /vault/systems, click into
  // a game, and the next question resolves against the game instead.
  const pathname = usePathname()
  const pathRef = useRef(pathname)
  useEffect(() => { pathRef.current = pathname }, [pathname])

  // Built once. A transport rebuilt on every render would tear down the
  // in-flight stream, so the live pathname is read through the ref above rather
  // than captured in this closure.
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/statbot',
        prepareSendMessagesRequest: ({ messages }) => ({
          body: { messages, context: { path: pathRef.current } },
        }),
      }),
    []
  )

  const { messages, sendMessage, setMessages, status, error } = useChat({ transport })

  const busy = status === 'submitted' || status === 'streaming'

  // Mirrored into a ref so the window listener below reads the live value
  // instead of the one captured when it was registered.
  const busyRef = useRef(busy)
  useEffect(() => { busyRef.current = busy }, [busy])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, status, limitHit])

  // Pick the conversation back up, the first time the panel is opened.
  //
  // Fetched here rather than passed down from the server component because
  // StatBotMount renders in the ROOT LAYOUT: loading it there would cost a
  // database round trip on every page render to fill a panel most visits never
  // open. The cost lands on the sessions that actually want it instead.
  //
  // Runs once per mount, guarded so a restore can never land on top of a
  // conversation already in progress -- a slow response arriving after the user
  // has started typing must not replace what they are doing.
  const restoredRef = useRef(false)
  useEffect(() => {
    if (!open || restoredRef.current || !tier) return
    restoredRef.current = true

    let cancelled = false
    setRestoring(true)
    fetch('/api/statbot/thread')
      .then(r => (r.ok ? r.json() : { messages: [] }))
      .then(body => {
        const stored = Array.isArray(body?.messages) ? (body.messages as UIMessage[]) : []
        if (cancelled || stored.length === 0) return
        setMessages(prev => (prev.length === 0 ? stored : prev))
      })
      .catch(() => {
        // A thread we cannot load is not worth an error banner. Starting fresh
        // is a complete, working panel.
      })
      .finally(() => { if (!cancelled) setRestoring(false) })

    return () => { cancelled = true }
  }, [open, tier, setMessages])

  // The daily cap is a normal outcome, not a failure. It arrives as a 429 the
  // transport surfaces as an error, so it is unpacked here and shown as its own
  // message with the reset time -- for guests and retail it is the sign-up and
  // upgrade prompt respectively.
  useEffect(() => {
    if (!error) return
    const raw = (error as any)?.message ?? ''
    const start = raw.indexOf('{')
    if (start === -1) return
    try {
      const body = JSON.parse(raw.slice(start))
      if (body?.resetsAt && body?.limit) {
        setLimitHit({
          message: body.error ?? `You have used today's ${body.limit} questions.`,
          resetsAt: body.resetsAt,
          anonymous: !!body.anonymous,
        })
      }
    } catch {
      // Not a quota response. Leave it to the generic error banner.
    }
  }, [error])

  // The homepage preview hands questions over by event rather than through
  // shared state, since that section and this panel are mounted separately.
  // preventDefault() is the acknowledgement. Since the bot now mounts for
  // signed-out visitors too, that acknowledgement is effectively always sent --
  // the preview's fallback to /signup is now only for the brief window before
  // this component hydrates.
  useEffect(() => {
    function onAsk(e: Event) {
      const text = (e as CustomEvent).detail?.text
      if (typeof text !== 'string' || !text.trim()) return
      e.preventDefault()
      setOpen(true)
      if (!busyRef.current && !limitHit) sendMessage({ text: text.trim() })
    }
    window.addEventListener('statbot:ask', onAsk)
    return () => window.removeEventListener('statbot:ask', onAsk)
  }, [sendMessage, limitHit])

  function submit(text: string) {
    const value = text.trim()
    if (!value || busy || limitHit) return
    sendMessage({ text: value })
    setInput('')
  }

  /**
   * Start over. Clears the panel immediately and drops the stored row behind
   * it; a failed delete is deliberately not surfaced, because the visible
   * outcome the user asked for -- an empty panel -- has already happened.
   */
  function newChat() {
    setMessages([])
    setLimitHit(null)
    setInput('')
    // Already restored once; leaving the guard set stops the deleted thread
    // being fetched back in if the panel is closed and reopened.
    restoredRef.current = true
    if (tier) void fetch('/api/statbot/thread', { method: 'DELETE' }).catch(() => {})
  }

  const isGuest = tier === null
  const suggestions = PROMPTS[tier ?? 'guest'] ?? PROMPTS.guest

  // At Private and above there is nothing meaningful left to sell, and a
  // permanent upgrade strip on a $199/mo membership reads as a service that
  // still thinks of you as a prospect. The gate goes quiet.
  const showUpsell = !isGuest && TIER_RANK[tier!] < TIER_RANK.private

  const resetLabel = limitHit
    ? new Date(limitHit.resetsAt).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
      })
    : null

  return (
    <>
      <button
        className={`analyst-fab${open ? ' is-open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close EdTheStatBot' : 'Open EdTheStatBot'}
      >
        <IconBot size={20} />
      </button>

      {open && (
        <div className="analyst-panel" role="dialog" aria-label="EdTheStatBot">
          <header className="analyst-head">
            <div>
              <span className="analyst-head__name">EdTheStatBot</span>
              <span className="analyst-head__tier">{tierLabel}</span>
            </div>
            <div className="analyst-head__actions">
              {messages.length > 0 && (
                <button className="analyst-new" onClick={newChat} title="Start a new conversation">
                  New chat
                </button>
              )}
              <button className="analyst-close" onClick={() => setOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>
          </header>

          <div className="analyst-body" ref={scrollRef}>
            {messages.length === 0 && !restoring && (
              <div className="analyst-intro">
                <p>
                  {isGuest ? (
                    <>
                      Ask what this service is, what it costs, or how the published record
                      actually looks. The picks, systems and trends themselves sit behind an
                      account — I can&apos;t read those for you yet.
                    </>
                  ) : showUpsell ? (
                    <>
                      Ask about the slate, a system&apos;s record, or what your membership covers.
                      Everything I quote comes from your own data — I can only reach what
                      {' '}{tierLabel} includes.
                    </>
                  ) : (
                    <>
                      Ask about the slate, a matchup, or anything in the Vault. Every number
                      I quote comes straight out of your data, with the record attached.
                    </>
                  )}
                </p>
                <div className="analyst-suggest">
                  {suggestions.map(s => (
                    <button key={s} onClick={() => submit(s)} className="analyst-suggest__btn">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(m => (
              <div key={m.id} className={`analyst-msg analyst-msg--${m.role}`}>
                {m.parts.map((part, i) => {
                  if (part.type === 'text') {
                    return <p key={i} className="analyst-msg__text">{part.text}</p>
                  }
                  // Tool activity is shown, not hidden: seeing which tool ran is
                  // how a user knows the answer came from their data.
                  if (part.type.startsWith('tool-')) {
                    const name = part.type.replace(/^tool-/, '')
                    const csv = (part as any)?.output?.csv
                    const filename = (part as any)?.output?.filename
                    return (
                      <div key={i}>
                        <div className="analyst-tool">
                          <span className="analyst-tool__dot" />
                          {name.replace(/_/g, ' ')}
                        </div>
                        {csv && (
                          <button
                            type="button"
                            className="analyst-suggest__btn"
                            onClick={() => downloadCsv(csv, filename ?? 'vault-export.csv')}
                          >
                            ↓ Download {filename ?? 'CSV'}
                          </button>
                        )}
                      </div>
                    )
                  }
                  return null
                })}
              </div>
            ))}

            {(busy || restoring) && (
              <div className="analyst-msg analyst-msg--assistant">
                <span className="analyst-typing"><i /><i /><i /></span>
              </div>
            )}

            {limitHit ? (
              <div className="analyst-error">
                {limitHit.message}{' '}
                {limitHit.anonymous ? (
                  <>
                    <Link href="/signup" style={{ color: 'var(--accent-teal)' }}>
                      Create a free account
                    </Link>{' '}
                    to keep going, or come back after {resetLabel} ET.
                  </>
                ) : (
                  <>
                    Resets at {resetLabel} ET.
                    {tier !== 'institutional' && (
                      <>
                        {' '}
                        <Link href="/win" style={{ color: 'var(--accent-teal)' }}>
                          Higher rungs ask more.
                        </Link>
                      </>
                    )}
                  </>
                )}
              </div>
            ) : error ? (
              <div className="analyst-error">
                Something went wrong reaching the desk. Try again in a moment.
              </div>
            ) : null}
          </div>

          {isGuest ? (
            <Link href="/signup" className="analyst-upsell">
              <IconLock size={12} />
              Sign up free to unlock the picks
              <IconArrowRight size={12} />
            </Link>
          ) : showUpsell ? (
            <Link href="/win" className="analyst-upsell">
              <IconLock size={12} />
              More research is available above {tierLabel}
              <IconArrowRight size={12} />
            </Link>
          ) : null}

          <form
            className="analyst-form"
            onSubmit={e => { e.preventDefault(); submit(input) }}
          >
            <input
              className="analyst-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={limitHit ? 'Back tomorrow…' : 'Ask EdTheStatBot…'}
              disabled={busy || !!limitHit}
            />
            <button
              className="analyst-send"
              type="submit"
              disabled={busy || !!limitHit || !input.trim()}
            >
              <IconArrowRight size={16} />
            </button>
          </form>

          <p className="analyst-disclaimer">
            Research only, never a guarantee. If gambling stops being fun, call 1-800-GAMBLER.
          </p>
        </div>
      )}
    </>
  )
}

/**
 * Hand the CSV to the browser as a file. Built from a Blob rather than a data:
 * URI so a large export does not hit URL length limits.
 */
function downloadCsv(csv: string, filename: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
