import type { Metadata } from 'next'
import CTASection from '@/components/CTASection'
import ContactForm from '@/components/ContactForm'

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch via email, Telegram, or Discord. We typically respond within 24–48 hours.',
  alternates: { canonical: 'https://edthestatman.com/contact' },
  openGraph: {
    title: 'Contact Us – EdTheStatMan.com',
    description: 'Get in touch via email, Telegram, or Discord. We typically respond within 24–48 hours.',
    url: 'https://edthestatman.com/contact',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact Us – EdTheStatMan.com',
    description: 'Get in touch via email, Telegram, or Discord. We typically respond within 24–48 hours.',
    images: ['/opengraph-image'],
  },
}

export default function Contact() {
  return (
    <main>
      {/* Page Header */}
      <header className="page-header">
        <div className="container">
          <div className="reveal">
            <span className="section-label">Get in Touch</span>
            <h1 className="page-header__title">Contact Us</h1>
            <p className="page-header__subtitle">Have a question about our betting systems, products, or services? Reach out and we&apos;ll get back to you as soon as possible.</p>
          </div>
        </div>
      </header>

      {/* Contact Section */}
      <section className="section">
        <div className="container">
          <div className="contact-grid">
            {/* Left Column: Contact Info */}
            <div className="contact-info reveal-left">
              <div className="contact-info__item">
                <div className="contact-info__icon">&#9993;</div>
                <div>
                  <div className="contact-info__label">Email</div>
                  <a href="mailto:ed@edthestatman.com" className="contact-info__value">ed@edthestatman.com</a>
                </div>
              </div>

              <div className="contact-info__item">
                <div className="contact-info__icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                </div>
                <div>
                  <div className="contact-info__label">Telegram</div>
                  <a href="https://t.me/edthestatman" className="contact-info__value" target="_blank" rel="noopener">@edthestatman</a>
                </div>
              </div>

              <div className="contact-info__item">
                <div className="contact-info__icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                </div>
                <div>
                  <div className="contact-info__label">Discord</div>
                  <a href="https://discord.gg/gqPrVBg4Aw" className="contact-info__value" target="_blank" rel="noopener">Join Our Server</a>
                </div>
              </div>

              <div className="contact-info__item">
                <div className="contact-info__icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </div>
                <div>
                  <div className="contact-info__label">X / Twitter</div>
                  <a href="https://x.com/EdTheStatMan" className="contact-info__value" target="_blank" rel="noopener">@EdTheStatMan</a>
                </div>
              </div>
            </div>

            {/* Right Column: Contact Form */}
            <div className="contact-form-wrapper reveal-right">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      {/* Response Times */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div className="reveal" style={{ textAlign: 'center' }}>
            <span className="section-label">What to Expect</span>
            <h2 className="section-title">Response <span className="text-gradient">Times</span></h2>
            <p className="section-subtitle" style={{ margin: '0 auto' }}>We aim to respond to all inquiries as quickly as possible. Here&apos;s what you can expect:</p>
          </div>
          <div className="reveal-scale" style={{ marginTop: '32px', maxWidth: '640px', marginLeft: 'auto', marginRight: 'auto' }}>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.8', marginBottom: '16px' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Email:</strong> We typically respond within 24–48 hours during business days. For urgent matters, consider reaching out via Telegram or Discord for faster response times.
            </p>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.8', marginBottom: '16px' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Telegram &amp; Discord:</strong> Our community channels are monitored regularly. For quick questions about picks, systems, or memberships, joining our Telegram or Discord is often the fastest way to get answers.
            </p>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.8' }}>
              Whether you have a question about our betting systems, want to learn more about our products, or just want to say hello — we&apos;re here to help. Don&apos;t hesitate to reach out!
            </p>
          </div>
        </div>
      </section>

      <CTASection />
    </main>
  )
}
