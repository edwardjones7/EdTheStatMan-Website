import Link from 'next/link'
import type { FeaturesContent, FeatureCard } from '@/lib/site-content'
import EditableText from './EditableText'

interface Props {
  content: FeaturesContent
  editMode?: boolean
  onEdit?: (updates: Partial<FeaturesContent>) => void
  resetKey?: number
}

const CARD_ICONS = ['&#128202;', '&#128200;', '&#129302;', '&#127942;', '&#128240;', '&#128276;']

export default function Features({ content, editMode, onEdit, resetKey = 0 }: Props) {
  const ed = editMode && onEdit

  function patchCard(i: number, updates: Partial<FeatureCard>) {
    if (!onEdit) return
    const cards = content.cards.map((c, j) => j === i ? { ...c, ...updates } : c)
    onEdit({ cards })
  }

  return (
    <section className="section" style={{ background: 'var(--bg-secondary)' }}>
      <div className="container">
        <div className="reveal" style={{ textAlign: 'center' }}>
          <span className="section-label">
            {ed
              ? <EditableText tag="span" value={content.label} onChange={v => onEdit({ label: v })} resetKey={resetKey} />
              : content.label}
          </span>
          <h2 className="section-title">
            {ed
              ? <EditableText tag="span" value={content.title} onChange={v => onEdit({ title: v })} resetKey={resetKey} />
              : content.title}{' '}
            <span className="text-gradient">
              {ed
                ? <EditableText tag="span" value={content.titleAccent} onChange={v => onEdit({ titleAccent: v })} resetKey={resetKey} />
                : content.titleAccent}
            </span>{' '}
            {ed
              ? <EditableText tag="span" value={content.titleSuffix} onChange={v => onEdit({ titleSuffix: v })} resetKey={resetKey} />
              : content.titleSuffix}
          </h2>
          <p className="section-subtitle" style={{ margin: '0 auto' }}>
            {ed
              ? <EditableText tag="span" value={content.subtitle} onChange={v => onEdit({ subtitle: v })} resetKey={resetKey} style={{ display: 'block' }} />
              : content.subtitle}
          </p>
        </div>

        <div className="features-grid stagger-children">
          {content.cards.map((card, i) => (
            <div key={i} className="feature-card">
              <div
                className={`card__icon card__icon--${card.iconColor}`}
                dangerouslySetInnerHTML={{ __html: CARD_ICONS[i] ?? '&#128202;' }}
              />
              <div className="feature-card__number">{card.number}</div>
              <h3 className="feature-card__title">
                {ed
                  ? <EditableText tag="span" value={card.title} onChange={v => patchCard(i, { title: v })} resetKey={resetKey} style={{ display: 'block' }} />
                  : card.title}
              </h3>
              <p className="feature-card__text">
                {ed
                  ? <EditableText tag="span" value={card.text} onChange={v => patchCard(i, { text: v })} resetKey={resetKey} style={{ display: 'block' }} />
                  : card.text}
              </p>
              {card.isExternal ? (
                <a href={card.href} className="feature-card__link" target="_blank" rel="noopener">
                  {ed
                    ? <EditableText tag="span" value={card.linkText} onChange={v => patchCard(i, { linkText: v })} resetKey={resetKey} />
                    : card.linkText}{' '}
                  <span>&#8594;</span>
                </a>
              ) : (
                <Link href={card.href} className="feature-card__link">
                  {ed
                    ? <EditableText tag="span" value={card.linkText} onChange={v => patchCard(i, { linkText: v })} resetKey={resetKey} />
                    : card.linkText}{' '}
                  <span>&#8594;</span>
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
