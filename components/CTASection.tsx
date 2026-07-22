'use client'

import type { CTAContent } from '@/lib/site-content'
import { DEFAULT_CTA } from '@/lib/site-content'
import EditableText from './EditableText'
import { IconBolt, IconChat, IconArrowRight } from './Icons'
import Link from 'next/link'
import { OFFER_ENTRY_PRICE } from '@/lib/offer'
import type { Membership } from '@/lib/access'

interface Props {
  content?: CTAContent
  editMode?: boolean
  onEdit?: (updates: Partial<CTAContent>) => void
  resetKey?: number
  /**
   * Who's looking. Defaults to 'active' so existing call sites keep the social
   * variant unchanged — only the buttons vary, never the editable copy, so the
   * site_content shape is untouched.
   */
  membership?: Membership
}

export default function CTASection({ content = DEFAULT_CTA, editMode, onEdit, resetKey = 0, membership = 'active' }: Props) {
  const ed = editMode && onEdit
  // Admins editing the page see the member variant so the editing surface is stable.
  const selling = !ed && (membership === 'logged-out' || membership === 'free' || membership === 'expired')

  return (
    <section className="cta-section">
      <div className="container">
        <div className="cta-box reveal-scale">
          <h2 className="cta-box__title">
            {ed ? (
              <>
                <EditableText tag="span" value={content.title} onChange={v => onEdit({ title: v })} resetKey={resetKey} />{' '}
                <EditableText tag="span" className="text-gradient" value={content.titleAccent} onChange={v => onEdit({ titleAccent: v })} resetKey={resetKey} />
              </>
            ) : (
              <>
                {content.title}{' '}
                <span className="text-gradient">{content.titleAccent}</span>
              </>
            )}
          </h2>
          <p className="cta-box__text">
            {ed
              ? <EditableText tag="span" value={content.text} onChange={v => onEdit({ text: v })} resetKey={resetKey} style={{ display: 'block' }} />
              : content.text}
          </p>
          <div className="cta-box__actions">
            {selling ? (
              <>
                <Link href="/win" className="btn btn--primary btn--lg">
                  {membership === 'expired'
                    ? 'Renew Access'
                    : `Unlock Full Access — ${OFFER_ENTRY_PRICE}`}{' '}
                  <IconArrowRight size={16} />
                </Link>
                <a href="https://x.com/EdTheStatMan" className="btn btn--secondary btn--lg" target="_blank" rel="noopener">
                  <span className="btn__icon"><IconBolt size={15} /></span> Follow on X
                </a>
              </>
            ) : (
              <>
                <a href="https://x.com/EdTheStatMan" className="btn btn--primary btn--lg" target="_blank" rel="noopener">
                  <span className="btn__icon"><IconBolt size={15} /></span> Follow on X
                </a>
                <a href="https://discord.gg/rXBZkSPcJb" className="btn btn--secondary btn--lg" target="_blank" rel="noopener">
                  <span className="btn__icon"><IconChat size={15} /></span> Join Discord
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
