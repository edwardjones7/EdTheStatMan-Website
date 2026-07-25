'use client'

import Link from 'next/link'
import Image from 'next/image'
import type { HeroContent } from '@/lib/site-content'
import EditableText from './EditableText'
import { IconChartBar, IconTrendUp, IconArrowRight } from './Icons'

interface Props {
  content: HeroContent
  isLoggedIn?: boolean
  editMode?: boolean
  onEdit?: (updates: Partial<HeroContent>) => void
  resetKey?: number
}

export default function Hero({ content, isLoggedIn = false, editMode, onEdit, resetKey = 0 }: Props) {
  const stats = [
    {
      value: `${content.stat1Prefix}${content.stat1Count}${content.stat1Suffix}`,
      countField: 'stat1Count' as const,
      labelField: 'stat1Label' as const,
      label: content.stat1Label,
      up: content.stat1Prefix === '+',
    },
    {
      value: `${content.stat2Count}${content.stat2Suffix}`,
      countField: 'stat2Count' as const,
      labelField: 'stat2Label' as const,
      label: content.stat2Label,
      up: false,
    },
    {
      value: `${content.stat3Count}${content.stat3Suffix}`,
      countField: 'stat3Count' as const,
      labelField: 'stat3Label' as const,
      label: content.stat3Label,
      up: false,
    },
  ]

  return (
    <section className="hero">
      <div className="hero__media">
        <Image
          src="/images/hero-stadium.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          style={{ objectFit: 'cover', objectPosition: 'center center' }}
        />
        <div className="hero__scrim" />
      </div>

      <div className="container hero__container">
        <div className="hero__content">
          <div className="hero__badge">
            <span className="pulse-dot"></span>
            {editMode && onEdit
              ? <EditableText tag="span" value={content.badge} onChange={v => onEdit({ badge: v })} resetKey={resetKey} />
              : content.badge}
          </div>

          <h1 className="hero__title">
            {editMode && onEdit ? (
              <>
                <EditableText tag="span" value={content.title} onChange={v => onEdit({ title: v })} resetKey={resetKey} />
                <br />
                <EditableText tag="span" className="accent" value={content.titleAccent} onChange={v => onEdit({ titleAccent: v })} resetKey={resetKey} />
              </>
            ) : (
              <>
                {content.title}
                <br />
                <span className="accent">{content.titleAccent}</span>
              </>
            )}
          </h1>

          <p className="hero__description">
            {editMode && onEdit
              ? <EditableText tag="span" value={content.description} onChange={v => onEdit({ description: v })} resetKey={resetKey} style={{ display: 'block' }} />
              : content.description}
          </p>

          <div className="hero__actions">
            {isLoggedIn ? (
              <>
                <Link href="/model-picks" className="btn btn--primary btn--lg">
                  Today&apos;s Picks <IconArrowRight size={16} />
                </Link>
                <Link href="/betting-systems" className="btn btn--glass btn--lg">
                  <IconChartBar size={16} /> Betting Systems
                </Link>
                <Link href="/betting-trends" className="btn btn--glass btn--lg">
                  <IconTrendUp size={16} /> Betting Trends
                </Link>
              </>
            ) : (
              <>
                <Link href="/signup" className="btn btn--primary btn--lg">
                  Sign Up Free <IconArrowRight size={16} />
                </Link>
                <Link href="/model-picks" className="btn btn--glass btn--lg">
                  See Today&apos;s Picks
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="hero__statbar">
        <div className="container hero__statbar-inner">
          {stats.map(stat => (
            <div className="hero__stat" key={stat.labelField}>
              <span className={`hero__stat-value${stat.up ? ' hero__stat-value--up' : ''}`}>
                {editMode && onEdit
                  ? <EditableText tag="span" value={content[stat.countField]} onChange={v => onEdit({ [stat.countField]: v })} resetKey={resetKey} />
                  : stat.value}
              </span>
              <span className="hero__stat-label">
                {editMode && onEdit
                  ? <EditableText tag="span" value={stat.label} onChange={v => onEdit({ [stat.labelField]: v })} resetKey={resetKey} />
                  : stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
