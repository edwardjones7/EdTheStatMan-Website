'use client'

import type { CTAContent } from '@/lib/site-content'
import { DEFAULT_CTA } from '@/lib/site-content'
import EditableText from './EditableText'

interface Props {
  content?: CTAContent
  editMode?: boolean
  onEdit?: (updates: Partial<CTAContent>) => void
  resetKey?: number
}

export default function CTASection({ content = DEFAULT_CTA, editMode, onEdit, resetKey = 0 }: Props) {
  const ed = editMode && onEdit

  return (
    <section className="cta-section">
      <div className="container">
        <div className="cta-box reveal-scale">
          <h2 className="cta-box__title">
            {ed
              ? <EditableText tag="span" value={content.title} onChange={v => onEdit({ title: v })} resetKey={resetKey} />
              : content.title}{' '}
            <span className="text-gradient">
              {ed
                ? <EditableText tag="span" value={content.titleAccent} onChange={v => onEdit({ titleAccent: v })} resetKey={resetKey} />
                : content.titleAccent}
            </span>
          </h2>
          <p className="cta-box__text">
            {ed
              ? <EditableText tag="span" value={content.text} onChange={v => onEdit({ text: v })} resetKey={resetKey} style={{ display: 'block' }} />
              : content.text}
          </p>
          <div className="cta-box__actions">
            <a href="https://t.me/edthestatman" className="btn btn--primary btn--lg" target="_blank" rel="noopener">
              <span className="btn__icon">&#9889;</span> Join Telegram
            </a>
            <a href="https://discord.gg/gqPrVBg4Aw" className="btn btn--secondary btn--lg" target="_blank" rel="noopener">
              <span className="btn__icon">&#128172;</span> Join Discord
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
