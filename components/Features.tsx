import Link from 'next/link'
import type { FeaturesContent } from '@/lib/site-content'
import AdminEditOverlay from './AdminEditOverlay'

interface Props {
  content: FeaturesContent
  isAdmin?: boolean
}

const ICON_EMOJIS: Record<string, string> = {
  cyan: '&#128202;',
  purple: '&#128200;',
  green: '&#129302;',
  gold: '&#127942;',
}

// Fallback per card index for icon emojis
const CARD_ICONS = ['&#128202;', '&#128200;', '&#129302;', '&#127942;', '&#128240;', '&#128276;']

export default function Features({ content, isAdmin }: Props) {
  return (
    <section className="section" style={{ background: 'var(--bg-secondary)', position: 'relative' }}>
      {isAdmin && <AdminEditOverlay section="features" label="Features" />}

      <div className="container">
        <div className="reveal" style={{ textAlign: 'center' }}>
          <span className="section-label">{content.label}</span>
          <h2 className="section-title">
            {content.title} <span className="text-gradient">{content.titleAccent}</span> {content.titleSuffix}
          </h2>
          <p className="section-subtitle" style={{ margin: '0 auto' }}>
            {content.subtitle}
          </p>
        </div>

        <div className="features-grid stagger-children">
          {content.cards.map((card, i) => (
            <div key={i} className="feature-card">
              <div
                className={`card__icon card__icon--${card.iconColor}`}
                dangerouslySetInnerHTML={{ __html: CARD_ICONS[i] ?? ICON_EMOJIS[card.iconColor] ?? '&#128202;' }}
              />
              <div className="feature-card__number">{card.number}</div>
              <h3 className="feature-card__title">{card.title}</h3>
              <p className="feature-card__text">{card.text}</p>
              {card.isExternal ? (
                <a href={card.href} className="feature-card__link" target="_blank" rel="noopener">
                  {card.linkText} <span>&#8594;</span>
                </a>
              ) : (
                <Link href={card.href} className="feature-card__link">
                  {card.linkText} <span>&#8594;</span>
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
