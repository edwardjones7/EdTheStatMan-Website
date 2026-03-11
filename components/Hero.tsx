'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import type { HeroContent } from '@/lib/site-content'
import EditableText from './EditableText'

interface Props {
  content: HeroContent
  editMode?: boolean
  onEdit?: (updates: Partial<HeroContent>) => void
  resetKey?: number
}

export default function Hero({ content, editMode, onEdit, resetKey = 0 }: Props) {
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
            <Link href="/betting-systems" className="btn btn--primary btn--lg">
              <span className="btn__icon">&#128202;</span> View Betting Systems
            </Link>
            <a href="#todays-action" className="btn btn--secondary btn--lg">
              Today&apos;s Action &#8595;
            </a>
          </div>

          <div className="hero__stats">
            <div className="hero__stat">
              <div
                className="hero__stat-value"
                data-count={content.stat1Count}
                data-prefix={content.stat1Prefix || undefined}
                data-suffix={content.stat1Suffix || undefined}
                data-decimals={content.stat1Decimals || undefined}
              >
                0{content.stat1Suffix}
              </div>
              <div className="hero__stat-label">
                {editMode && onEdit
                  ? <EditableText tag="span" value={content.stat1Label} onChange={v => onEdit({ stat1Label: v })} resetKey={resetKey} />
                  : content.stat1Label}
              </div>
            </div>
            <div className="hero__stat">
              <div
                className="hero__stat-value"
                data-count={content.stat2Count}
                data-suffix={content.stat2Suffix || undefined}
              >
                0
              </div>
              <div className="hero__stat-label">
                {editMode && onEdit
                  ? <EditableText tag="span" value={content.stat2Label} onChange={v => onEdit({ stat2Label: v })} resetKey={resetKey} />
                  : content.stat2Label}
              </div>
            </div>
            <div className="hero__stat">
              <div
                className="hero__stat-value"
                data-count={content.stat3Count}
                data-suffix={content.stat3Suffix || undefined}
              >
                0
              </div>
              <div className="hero__stat-label">
                {editMode && onEdit
                  ? <EditableText tag="span" value={content.stat3Label} onChange={v => onEdit({ stat3Label: v })} resetKey={resetKey} />
                  : content.stat3Label}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
