'use client'

import { useState } from 'react'
import type {
  AllSiteContent,
  FeaturesContent,
  CTAContent,
  FeatureCard,
} from '@/lib/site-content'

interface Props {
  content: AllSiteContent
}

type SectionKey = keyof AllSiteContent

export default function AdminContentTab({ content: initialContent }: Props) {
  const [content, setContent] = useState<AllSiteContent>(initialContent)
  const [open, setOpen] = useState<SectionKey | null>('features')
  const [saving, setSaving] = useState<SectionKey | null>(null)
  const [saved, setSaved] = useState<SectionKey | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function save(key: SectionKey) {
    setSaving(key)
    setErr(null)
    try {
      const res = await fetch('/api/admin/content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: content[key] }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErr(json.error ?? 'Save failed')
      } else {
        setSaved(key)
        setTimeout(() => setSaved(null), 2500)
      }
    } catch {
      setErr('Network error')
    } finally {
      setSaving(null)
    }
  }

  function patch<K extends SectionKey>(section: K, updates: Partial<AllSiteContent[K]>) {
    setContent(prev => ({
      ...prev,
      [section]: { ...prev[section], ...updates },
    }))
  }

  function toggle(key: SectionKey) {
    setOpen(prev => (prev === key ? null : key))
  }

  return (
    <div className="admin-section" id="content">
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Page Content Editor
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
          Edit the text shown on the home page. Changes go live immediately after saving.
        </p>
      </div>

      {err && (
        <div style={{ background: 'rgba(var(--down-rgb), 0.1)', border: '1px solid rgba(var(--down-rgb), 0.3)', borderRadius: '8px', padding: '10px 14px', color: 'var(--down)', fontSize: '0.85rem', marginBottom: '16px' }}>
          {err}
        </div>
      )}


      {/* ── Features ── */}
      <ContentAccordion
        id="features"
        label="Features Section"
        open={open === 'features'}
        onToggle={() => toggle('features')}
        saving={saving === 'features'}
        saved={saved === 'features'}
        onSave={() => save('features')}
      >
        <TwoCol>
          <Field label="Section label" value={content.features.label} onChange={v => patch('features', { label: v })} />
          <Field label="Title (before accent)" value={content.features.title} onChange={v => patch('features', { title: v })} />
        </TwoCol>
        <TwoCol>
          <Field label="Title accent" value={content.features.titleAccent} onChange={v => patch('features', { titleAccent: v })} />
          <Field label="Title suffix" value={content.features.titleSuffix} onChange={v => patch('features', { titleSuffix: v })} />
        </TwoCol>
        <Field label="Subtitle" value={content.features.subtitle} onChange={v => patch('features', { subtitle: v })} />

        <SectionDivider label="Feature Cards" />
        {content.features.cards.map((card, i) => (
          <FeatureCardEditor
            key={i}
            index={i}
            card={card}
            onChange={updated => {
              const cards = content.features.cards.map((c, j) => (j === i ? updated : c))
              patch('features', { cards })
            }}
          />
        ))}
      </ContentAccordion>

      {/* ── CTA Section ── */}
      <ContentAccordion
        id="cta_section"
        label="CTA Banner"
        open={open === 'cta_section'}
        onToggle={() => toggle('cta_section')}
        saving={saving === 'cta_section'}
        saved={saved === 'cta_section'}
        onSave={() => save('cta_section')}
      >
        <TwoCol>
          <Field label="Title (before accent)" value={content.cta_section.title} onChange={v => patch('cta_section', { title: v })} />
          <Field label="Title accent" value={content.cta_section.titleAccent} onChange={v => patch('cta_section', { titleAccent: v })} />
        </TwoCol>
        <Field label="Body text" type="textarea" value={content.cta_section.text} onChange={v => patch('cta_section', { text: v })} />
      </ContentAccordion>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ContentAccordion({
  id,
  label,
  open,
  onToggle,
  saving,
  saved,
  onSave,
  children,
}: {
  id: string
  label: string
  open: boolean
  onToggle: () => void
  saving: boolean
  saved: boolean
  onSave: () => void
  children: React.ReactNode
}) {
  return (
    <div
      id={id}
      style={{
        border: '1px solid var(--border)',
        borderRadius: '10px',
        marginBottom: '12px',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          background: open ? 'rgba(var(--brand-rgb), 0.06)' : 'var(--bg-secondary)',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          fontWeight: 600,
          fontSize: '0.9rem',
          textAlign: 'left',
        }}
      >
        <span>{label}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '18px', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {children}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
            <button
              className="btn btn--primary btn--sm"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            {saved && (
              <span style={{ color: 'var(--accent-teal)', fontSize: '0.85rem', fontWeight: 600 }}>
                ✓ Saved
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: 'text' | 'textarea'
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      {type === 'textarea' ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={3}
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '8px 10px',
            color: 'var(--text-primary)',
            fontSize: '0.875rem',
            resize: 'vertical',
            fontFamily: 'inherit',
            lineHeight: '1.5',
          }}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '8px 10px',
            color: 'var(--text-primary)',
            fontSize: '0.875rem',
            fontFamily: 'inherit',
          }}
        />
      )}
    </div>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          padding: '8px 10px',
          color: 'var(--text-primary)',
          fontSize: '0.875rem',
          fontFamily: 'inherit',
        }}
      >
        {options.map(o => (
          <option key={o} value={o}>
            {o.charAt(0).toUpperCase() + o.slice(1)}
          </option>
        ))}
      </select>
    </div>
  )
}

function TwoCol({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
      {children}
    </div>
  )
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '4px 0' }}>
      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-teal)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
    </div>
  )
}

function FeatureCardEditor({
  index,
  card,
  onChange,
}: {
  index: number
  card: FeatureCard
  onChange: (updated: FeatureCard) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(p => !p)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'var(--bg-secondary)',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          fontWeight: 600,
          fontSize: '0.82rem',
          textAlign: 'left',
        }}
      >
        <span>Card {card.number} — {card.title}</span>
        <span style={{ color: 'var(--text-muted)' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg-primary)' }}>
          <TwoCol>
            <Field label="Title" value={card.title} onChange={v => onChange({ ...card, title: v })} />
            <Field label="Link text" value={card.linkText} onChange={v => onChange({ ...card, linkText: v })} />
            <Field label="Link URL" value={card.href} onChange={v => onChange({ ...card, href: v })} />
            <SelectField
              label="Icon color"
              value={card.iconColor}
              options={['cyan', 'purple', 'green', 'gold']}
              onChange={v => onChange({ ...card, iconColor: v as FeatureCard['iconColor'] })}
            />
          </TwoCol>
          <Field label="Description" type="textarea" value={card.text} onChange={v => onChange({ ...card, text: v })} />
        </div>
      )}
    </div>
  )
}
