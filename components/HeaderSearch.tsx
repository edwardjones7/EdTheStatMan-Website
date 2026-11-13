'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { SearchResponse } from '@/lib/search-types'
import '@/styles/chrome.css'

/**
 * The header search: a button that opens a panel under the bar with one input.
 * Teams, upcoming games and Vault codes, from /api/search (CDN-cached per
 * query). Debounced 250ms; arrow keys move through the results, Enter opens
 * one, Escape closes. "/" opens it from anywhere that is not a text field.
 */

interface Row {
  group: 'Teams' | 'Games' | 'Vault'
  key: string
  href: string
  title: string
  meta: string
  logo?: string | null
  badge?: string
}

function toRows(r: SearchResponse | null): Row[] {
  if (!r) return []
  return [
    ...r.teams.map(t => ({
      group: 'Teams' as const, key: `t-${t.sport}-${t.abbrev}`, href: t.href,
      title: t.name, meta: `${t.sportLabel} · Team page`, logo: t.logo, badge: t.abbrev,
    })),
    ...r.games.map(g => ({
      group: 'Games' as const, key: `g-${g.id}`, href: g.href,
      title: g.label, meta: `${g.sportLabel} · ${g.when}`,
    })),
    ...r.vault.map(v => ({
      group: 'Vault' as const, key: `v-${v.kind}-${v.code}`, href: v.href,
      title: v.code, meta: `${v.sport.toUpperCase()} · ${v.kind === 'systems' ? 'System' : 'Trend'}`,
    })),
  ]
}

export default function HeaderSearch() {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [data, setData] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const listId = useId()

  const rows = useMemo(() => toRows(data), [data])

  const close = useCallback(() => {
    setOpen(false)
  }, [])

  // Close on navigation.
  useEffect(() => { setOpen(false) }, [pathname])

  // "/" opens; Escape closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        setOpen(false)
        btnRef.current?.focus()
        return
      }
      if (e.key !== '/' || open || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      e.preventDefault()
      setOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  // Click outside closes.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Debounced fetch.
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const ctl = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term.toLowerCase())}`, { signal: ctl.signal })
        if (!res.ok) throw new Error(String(res.status))
        const json = (await res.json()) as SearchResponse
        setData(json)
        setActive(0)
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setData({ q: term, teams: [], games: [], vault: [] })
      } finally {
        if (!ctl.signal.aborted) setLoading(false)
      }
    }, 250)
    return () => { clearTimeout(timer); ctl.abort() }
  }, [q])

  const go = (href: string) => {
    setOpen(false)
    setQ('')
    router.push(href)
  }

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (rows.length) setActive(a => (a + 1) % rows.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (rows.length) setActive(a => (a - 1 + rows.length) % rows.length)
    } else if (e.key === 'Enter') {
      const row = rows[active]
      if (row) { e.preventDefault(); go(row.href) }
    }
  }

  // Keep the active row in view.
  useEffect(() => {
    const el = panelRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const term = q.trim()
  let idx = -1
  const groups: Row['group'][] = ['Teams', 'Games', 'Vault']

  return (
    <div className="hsearch">
      <button
        ref={btnRef}
        type="button"
        className={`hsearch__btn${open ? ' is-open' : ''}`}
        aria-label="Search teams, games and Vault codes"
        aria-expanded={open}
        title="Search (press /)"
        onClick={() => (open ? close() : setOpen(true))}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.6-3.6" />
        </svg>
        <span className="hsearch__btn-label">Search</span>
      </button>

      {open && (
        <div ref={panelRef} className="hsearch__panel" role="dialog" aria-label="Search">
          <div className="hsearch__field">
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.6-3.6" />
            </svg>
            <input
              ref={inputRef}
              type="search"
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={onInputKey}
              placeholder="Team, matchup or Vault code"
              aria-label="Search"
              role="combobox"
              aria-expanded={rows.length > 0}
              aria-controls={listId}
              aria-activedescendant={rows[active] ? `${listId}-${active}` : undefined}
              autoComplete="off"
              spellCheck={false}
              maxLength={60}
            />
            <button type="button" className="hsearch__close" onClick={close} aria-label="Close search">Esc</button>
          </div>

          <div className="hsearch__results" id={listId} role="listbox" aria-label="Results">
            {term.length < 2 ? (
              <p className="hsearch__hint">Try a team (&ldquo;Packers&rdquo;, &ldquo;Duke&rdquo;), an abbreviation (&ldquo;KC&rdquo;) or a Vault code (&ldquo;NFLS00006&rdquo;).</p>
            ) : rows.length === 0 ? (
              <p className="hsearch__hint">{loading ? 'Searching…' : `Nothing found for “${term}”.`}</p>
            ) : (
              groups.map(g => {
                const items = rows.filter(r => r.group === g)
                if (items.length === 0) return null
                return (
                  <div key={g} className="hsearch__group" role="group" aria-label={g}>
                    <div className="hsearch__group-hd">{g}</div>
                    {items.map(r => {
                      idx += 1
                      const i = idx
                      return (
                        <a
                          key={r.key}
                          id={`${listId}-${i}`}
                          data-idx={i}
                          role="option"
                          aria-selected={i === active}
                          href={r.href}
                          className={`hsearch__row${i === active ? ' is-active' : ''}`}
                          onMouseEnter={() => setActive(i)}
                          onClick={e => {
                            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
                            e.preventDefault()
                            go(r.href)
                          }}
                        >
                          <span className="hsearch__ico" aria-hidden="true">
                            {r.logo
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={r.logo} alt="" width={22} height={22} loading="lazy" />
                              : <span className="hsearch__ico-txt">{r.group === 'Vault' ? 'V' : r.group === 'Games' ? 'vs' : (r.badge ?? '').slice(0, 3)}</span>}
                          </span>
                          <span className="hsearch__txt">
                            <span className="hsearch__title">{r.title}</span>
                            <span className="hsearch__meta">{r.meta}</span>
                          </span>
                        </a>
                      )
                    })}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
