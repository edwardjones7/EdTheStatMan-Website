import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PricingCards from '@/components/PricingCards'
import CheckoutAutoStart from '@/components/CheckoutAutoStart'
import { OFFER_DISCLAIMER, OFFER_META_DESCRIPTION, planByKey } from '@/lib/offer'
import CTASection from '@/components/CTASection'
import { resolveAccess, ACCESS_SELECT, TIER_SHORT_LABEL } from '@/lib/access'

// Title and description are the ladder's, not the pre-v3 offer's. Both used to
// name Basic, Premium and the Elite Season Pass at prices that no longer exist,
// which is what search results and every shared link showed. The description is
// derived from OFFER_PLANS so it cannot drift again.
export const metadata: Metadata = {
  title: 'Membership',
  description: OFFER_META_DESCRIPTION,
  alternates: { canonical: 'https://edthestatman.com/win' },
  openGraph: {
    title: 'Membership – EdTheStatMan.com',
    description: OFFER_META_DESCRIPTION,
    url: 'https://edthestatman.com/win',
    images: [{ url: '/og-cover.jpg', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Membership – EdTheStatMan.com',
    description: OFFER_META_DESCRIPTION,
    images: ['/og-cover.jpg'],
  },
}

export default async function Pricing({
  searchParams,
}: {
  searchParams: { checkout?: string; canceled?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let access = resolveAccess(null, false)
  if (user) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select(ACCESS_SELECT)
      .eq('id', user.id)
      .single()
    access = resolveAccess(profile as any, true)
  }
  const { tier: userTier, isAdmin, isPaid, membership, expiresAt } = access


  const resumePlan = user && !isPaid ? planByKey(searchParams.checkout ?? '') : undefined

  return (
    <main>
      {resumePlan && <CheckoutAutoStart priceId={resumePlan.season.priceId} planName={resumePlan.name} />}
      {/* Header */}
      <header className="page-header">
        <div className="container">
          <div className="reveal" style={{ textAlign: 'center' }}>
            <span className="section-label">Membership</span>
            <h1 className="page-header__title">Simple, Transparent <span className="text-gradient">Pricing</span></h1>
            <p className="page-header__subtitle">
              The Vault holds the data. The Research Desk puts it on a schedule.
              The Portfolio is the picks themselves. Start anywhere on the ladder —
              every rung includes everything below it.
            </p>
          </div>
        </div>
      </header>

      {/* Pricing cards */}
      <section className="section" id="pricing">
        <div className="container">

          {searchParams.canceled === '1' && (
            <div className="reveal" style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{
                display: 'inline-block',
                background: 'rgba(var(--gold-rgb),0.1)',
                border: '1px solid rgba(var(--gold-rgb),0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 24px',
                color: 'var(--accent-gold)',
                fontSize: '0.9rem',
              }}>
                Checkout cancelled — no charge was made. Your card wasn&apos;t billed.
              </div>
            </div>
          )}

          {membership === 'expired' && (
            <div className="reveal" style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{
                display: 'inline-block',
                background: 'rgba(var(--gold-rgb),0.1)',
                border: '1px solid rgba(var(--gold-rgb),0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 24px',
                color: 'var(--accent-gold)',
                fontWeight: 600,
              }}>
                Your access has expired. Pick a pass below to pick up where you left off.
              </div>
            </div>
          )}

          {isPaid && (
            <div className="reveal" style={{ textAlign: 'center', marginBottom: '40px' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                background: 'rgba(45,212,191,0.1)',
                border: '1px solid rgba(45,212,191,0.3)',
                borderRadius: '10px',
                padding: '12px 24px',
                color: 'var(--accent-teal)',
                fontWeight: 600,
              }}>
                ✓ {TIER_SHORT_LABEL[userTier ?? 'retail']} access active
                {expiresAt ? ` until ${expiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : ''}.{' '}
                <Link href="/account" style={{ color: 'var(--accent-teal)', textDecoration: 'underline' }}>
                  View account →
                </Link>
              </div>
            </div>
          )}

          <PricingCards membership={membership} currentTier={userTier} showFree />

          <div className="reveal" style={{ maxWidth: '640px', margin: '56px auto 0', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.8 }}>
              {OFFER_DISCLAIMER}{' '}
              Questions? <Link href="/contact" style={{ color: 'var(--accent-teal)' }}>Contact us</Link>.
            </p>
          </div>

        </div>
      </section>

      <CTASection />
    </main>
  )
}
