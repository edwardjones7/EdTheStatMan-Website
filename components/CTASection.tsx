import type { CTAContent } from '@/lib/site-content'
import { DEFAULT_CTA } from '@/lib/site-content'
import AdminEditOverlay from './AdminEditOverlay'

interface Props {
  content?: CTAContent
  isAdmin?: boolean
}

export default function CTASection({ content = DEFAULT_CTA, isAdmin }: Props) {
  return (
    <section className="cta-section" style={{ position: 'relative' }}>
      {isAdmin && <AdminEditOverlay section="cta_section" label="CTA Banner" />}

      <div className="container">
        <div className="cta-box reveal-scale">
          <h2 className="cta-box__title">
            {content.title} <span className="text-gradient">{content.titleAccent}</span>
          </h2>
          <p className="cta-box__text">{content.text}</p>
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
