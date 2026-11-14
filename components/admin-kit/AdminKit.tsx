'use client'

/**
 * The admin kit: one bar, one side panel, one toast stack and one confirm
 * dialog, shared by every page an admin can edit from. Mounted by the root
 * layout for admins only; for everyone else useAdminKit() returns null and
 * every admin control renders nothing.
 *
 * Pages put their own buttons in the bar with <AdminActions>, which portals
 * them into the bar's page slot. So the bar is always in the same place, and
 * each page only says which actions it has.
 */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ADMIN_FLAG_KEY } from '@/lib/track-client'
import './admin-kit.css'

type Tone = 'ok' | 'error' | 'info'
interface Toast { id: number; text: ReactNode; tone: Tone }
interface Panel { title: string; body: ReactNode; wide?: boolean }
interface ConfirmOpts { title: string; body?: ReactNode; confirm?: string; danger?: boolean }

export interface AdminKit {
  toast: (text: ReactNode, tone?: Tone) => void
  confirm: (opts: ConfirmOpts) => Promise<boolean>
  openPanel: (panel: Panel) => void
  closePanel: () => void
  /** Set while a panel holds unsaved edits, so closing it asks first. */
  setPanelDirty: (dirty: boolean) => void
  pageSlot: HTMLElement | null
  globalSlot: HTMLElement | null
}

const Ctx = createContext<AdminKit | null>(null)

export function useAdminKit(): AdminKit | null {
  return useContext(Ctx)
}

const PAGE_NAMES: [RegExp, string][] = [
  [/^\/$/, 'Home'],
  [/^\/portfolio\/performance/, 'Results'],
  [/^\/portfolio/, 'Portfolio'],
  [/^\/desk\/[^/]+\/g\//, 'Desk game'],
  [/^\/desk\/[^/]+\/team\//, 'Team page'],
  [/^\/desk/, 'Research Desk'],
  [/^\/vault\/systems/, 'Vault systems'],
  [/^\/vault\/trends/, 'Vault trends'],
  [/^\/vault/, 'The Vault'],
  [/^\/news/, 'The Wire'],
  [/^\/admin\/posts/, 'Post editor'],
  [/^\/admin/, 'Dashboard'],
  [/^\/win/, 'Membership'],
]

function pageName(path: string): string {
  return PAGE_NAMES.find(([re]) => re.test(path))?.[1] ?? 'This page'
}

export function AdminKitProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [panel, setPanel] = useState<Panel | null>(null)
  const [dialog, setDialog] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null)
  const [pageSlot, setPageSlot] = useState<HTMLElement | null>(null)
  const [globalSlot, setGlobalSlot] = useState<HTMLElement | null>(null)
  const dirtyRef = useRef(false)
  const nextId = useRef(1)
  const pathname = usePathname() ?? '/'
  const onDashboard = pathname.startsWith('/admin') && !pathname.startsWith('/admin/posts')

  const toast = useCallback((text: ReactNode, tone: Tone = 'ok') => {
    const id = nextId.current++
    setToasts(t => [...t, { id, text, tone }])
    window.setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), tone === 'error' ? 8000 : 4500)
  }, [])

  const confirm = useCallback((opts: ConfirmOpts) =>
    new Promise<boolean>(resolve => setDialog({ ...opts, resolve })), [])

  const openPanel = useCallback((p: Panel) => { dirtyRef.current = false; setPanel(p) }, [])
  const forceClose = useCallback(() => { dirtyRef.current = false; setPanel(null) }, [])
  const setPanelDirty = useCallback((d: boolean) => { dirtyRef.current = d }, [])

  const closePanel = useCallback(async () => {
    if (dirtyRef.current) {
      const ok = await confirm({ title: 'Discard your changes?', body: 'Nothing has been saved yet.', confirm: 'Discard', danger: true })
      if (!ok) return
    }
    forceClose()
  }, [confirm, forceClose])

  // Escape closes the dialog first, then the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (dialog) { dialog.resolve(false); setDialog(null) } else if (panel) closePanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog, panel, closePanel])

  // Leaving the page with a dirty panel asks the browser to warn.
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => { if (dirtyRef.current) e.preventDefault() }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [])

  // A route change closes whatever panel belonged to the old page.
  useEffect(() => { forceClose() }, [pathname, forceClose])

  // The bar takes room at the top of the page, so nothing sits under it.
  useEffect(() => {
    document.body.classList.add('has-admin-bar')
    // This browser belongs to an admin: it stops counting toward traffic, even
    // after signing out (lib/track-client.ts canTrack).
    try { localStorage.setItem(ADMIN_FLAG_KEY, '1') } catch {}
    return () => document.body.classList.remove('has-admin-bar')
  }, [])

  const kit = useMemo<AdminKit>(() => ({
    toast, confirm, openPanel, closePanel: () => { void closePanel() }, setPanelDirty, pageSlot, globalSlot,
  }), [toast, confirm, openPanel, closePanel, setPanelDirty, pageSlot, globalSlot])

  return (
    <Ctx.Provider value={kit}>
      <div className="akit-bar" role="region" aria-label="Admin tools">
        <span className="akit-bar__who"><i aria-hidden /> Admin</span>
        <span className="akit-bar__page">{pageName(pathname)}</span>
        <div className="akit-bar__actions" ref={setPageSlot} />
        <div className="akit-bar__right">
          <div className="akit-bar__actions" ref={setGlobalSlot} />
          {!onDashboard && <Link href="/admin" className="akit-btn akit-btn--ghost">Dashboard →</Link>}
        </div>
      </div>

      {children}

      {panel && (
        <div className="akit-scrim" onMouseDown={e => { if (e.target === e.currentTarget) void closePanel() }}>
          <aside className={`akit-panel${panel.wide ? ' akit-panel--wide' : ''}`} role="dialog" aria-modal="true" aria-label={panel.title}>
            <header className="akit-panel__hd">
              <h2>{panel.title}</h2>
              <button type="button" className="akit-icon" aria-label="Close" onClick={() => void closePanel()}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </header>
            <div className="akit-panel__body">{panel.body}</div>
          </aside>
        </div>
      )}

      {dialog && (
        <div className="akit-scrim akit-scrim--center">
          <div className="akit-dialog" role="alertdialog" aria-modal="true" aria-label={dialog.title}>
            <h2>{dialog.title}</h2>
            {dialog.body && <div className="akit-dialog__body">{dialog.body}</div>}
            <div className="akit-dialog__actions">
              <button type="button" className="akit-btn" autoFocus onClick={() => { dialog.resolve(false); setDialog(null) }}>Cancel</button>
              <button
                type="button"
                className={`akit-btn ${dialog.danger ? 'akit-btn--danger' : 'akit-btn--primary'}`}
                onClick={() => { dialog.resolve(true); setDialog(null) }}
              >
                {dialog.confirm ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="akit-toasts" aria-live="polite">
        {toasts.map(t => <div key={t.id} className={`akit-toast akit-toast--${t.tone}`}>{t.text}</div>)}
      </div>
    </Ctx.Provider>
  )
}

/** This page's buttons, shown in the admin bar. Renders nothing for non-admins. */
export function AdminActions({ children, global = false }: { children: ReactNode; global?: boolean }) {
  const kit = useAdminKit()
  const slot = global ? kit?.globalSlot : kit?.pageSlot
  if (!slot) return null
  return createPortal(children, slot)
}
