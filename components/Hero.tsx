'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import type { HeroContent } from '@/lib/site-content'
import EditableText from './EditableText'

interface Props {
  content: HeroContent
  isLoggedIn?: boolean
  editMode?: boolean
  onEdit?: (updates: Partial<HeroContent>) => void
  resetKey?: number
}

export default function Hero({ content, isLoggedIn = false, editMode, onEdit, resetKey = 0 }: Props) {
  const particlesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!particlesRef.current) return
    const particleCount = 30
    const colors = ['#34d399', '#6ee7b7', '#818cf8', '#06b6d4']
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div')
      particle.className = 'hero__particle'
      particle.style.left = Math.random() * 100 + '%'
      particle.style.animationDelay = Math.random() * 8 + 's'
      particle.style.animationDuration = (6 + Math.random() * 6) + 's'
      particle.style.width = (2 + Math.random() * 4) + 'px'
      particle.style.height = particle.style.width
      particle.style.opacity = String(0.1 + Math.random() * 0.3)
      particle.style.background = colors[Math.floor(Math.random() * colors.length)]
      particlesRef.current.appendChild(particle)
    }
  }, [])

  const e = (field: keyof HeroContent) =>
    editMode && onEdit
      ? { as: EditableText, value: content[field] as string, onChange: (v: string) => onEdit({ [field]: v }), resetKey }
      : null

  return (
    <section className="hero">
      <div className="hero__bg">
        <div className="hero__particles" ref={particlesRef}></div>
        <div className="hero__gradient"></div>
      </div>

      <div className="container">
        <div className="hero__content">
          <div className="hero__badge">
            <span className="pulse-dot"></span>
            {editMode && onEdit
              ? <EditableText tag="span" value={content.badge} onChange={v => onEdit({ badge: v })} resetKey={resetKey} />
              : content.badge}
          </div>

          <h1 className="hero__title">
            {editMode && onEdit
              ? <EditableText tag="span" value={content.title} onChange={v => onEdit({ title: v })} resetKey={resetKey} />
              : content.title}
            <br />
            <span className="accent">
              {editMode && onEdit
                ? <EditableText tag="span" value={content.titleAccent} onChange={v => onEdit({ titleAccent: v })} resetKey={resetKey} />
                : content.titleAccent}
            </span>
          </h1>

          <p className="hero__description">
            {editMode && onEdit
              ? <EditableText tag="span" value={content.description} onChange={v => onEdit({ description: v })} resetKey={resetKey} style={{ display: 'block' }} />
              : content.description}
          </p>

          <div className="hero__actions">
            {isLoggedIn ? (
              <>
                <Link href="/betting-systems" className="btn btn--primary btn--sm">
                  <span className="btn__icon">&#128202;</span> View Betting Systems
                </Link>
                <Link href="/betting-trends" className="btn btn--secondary btn--sm">
                  <span className="btn__icon">&#128200;</span> View Betting Trends
                </Link>
                <Link href="/model-picks" className="btn btn--secondary btn--sm">
                  Today&apos;s Action &#8595;
                </Link>
              </>
            ) : (
              <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                <Link href="/signup" className="btn btn--primary btn--lg">
                  Sign Up For Free Today
                </Link>
              </div>
            )}
          </div>

        </div>
      </div>
    </section>
  )
}

// Styled input that matches .hero__stat-value appearance
function StatInput({ value, onChange, resetKey }: { value: string; onChange: (v: string) => void; resetKey: number }) {
  return (
    <input
      key={resetKey}
      type="text"
      defaultValue={value}
      onBlur={e => onChange(e.target.value)}
      style={{
        background: 'transparent',
        border: 'none',
        borderBottom: '1px dashed rgba(52,211,153,0.55)',
        outline: 'none',
        color: 'var(--text-primary)',
        fontSize: 'clamp(1.4rem, 3vw, 2rem)',
        fontWeight: 800,
        fontFamily: 'var(--font-mono, monospace)',
        width: '100%',
        textAlign: 'center',
        cursor: 'text',
        padding: '2px 0',
      }}
    />
  )
}
