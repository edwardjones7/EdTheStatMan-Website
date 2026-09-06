import Link from 'next/link'
import PushOptIn from './PushOptIn'
import { IconBolt, IconChat } from './Icons'

/**
 * The "how to hear about the next one" banner, closing the Portfolio.
 *
 * It used to sit directly under the picks table, between the info cards and the
 * performance numbers, where it interrupted the page mid-argument: it asked for
 * a subscription before the reader had reached the record that justifies one.
 * At the bottom it lands after the case has been made.
 *
 * Not a client component. PushOptIn is, and it stays so; this only renders it.
 */
export default function NeverMissAPick({ userTier }: { userTier: string | null }) {
  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="container">
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '48px 32px',
          textAlign: 'center',
        }}>
          <h2 style={{
            fontSize: 'clamp(1.4rem, 3vw, 2rem)',
            marginBottom: '12px',
            color: 'var(--text-heading)',
          }}>
            Never Miss a Pick
          </h2>
          <p style={{
            color: 'var(--text-secondary)',
            maxWidth: '540px',
            margin: '0 auto 28px',
            lineHeight: 1.7,
          }}>
            Get instant notifications the moment picks drop. Turn on browser alerts, or follow us on X and join Discord for real-time alerts, system updates, and community discussion.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {/* Push is per-account, so it's only offered to signed-in members. */}
            {userTier !== null && <PushOptIn />}
            <a href="https://x.com/EdTheStatMan" className="btn btn--primary btn--sm" target="_blank" rel="noopener">
              <IconBolt size={14} /> Follow on X
            </a>
            <a href="https://discord.gg/rXBZkSPcJb" className="btn btn--secondary btn--sm" target="_blank" rel="noopener">
              <IconChat size={14} /> Join Discord
            </a>
            {userTier === null && (
              <Link href="/signup" className="btn btn--outline btn--sm">
                Sign Up Free
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
