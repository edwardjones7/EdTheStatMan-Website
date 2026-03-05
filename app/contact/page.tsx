import type { Metadata } from 'next'
import CTASection from '@/components/CTASection'

export const metadata: Metadata = {
  title: 'Contact Us – EdTheStatMan.com',
  description: 'Get in touch via email, Telegram, or Discord. We typically respond within 24–48 hours.',
  openGraph: {
    title: 'Contact Us – EdTheStatMan.com',
    description: 'Get in touch via email, Telegram, or Discord. We typically respond within 24–48 hours.',
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
                  <a href="mailto:contact@edthestatman.com" className="contact-info__value">contact@edthestatman.com</a>
                </div>
              </div>

              <div className="contact-info__item">
                <div className="contact-info__icon">&#9889;</div>
                <div>
                  <div className="contact-info__label">Telegram</div>
                  <a href="https://t.me/edthestatman" className="contact-info__value" target="_blank" rel="noopener">@edthestatman</a>
                </div>
              </div>

              <div className="contact-info__item">
                <div className="contact-info__icon">&#128172;</div>
                <div>
                  <div className="contact-info__label">Discord</div>
                  <a href="https://discord.gg/gqPrVBg4Aw" className="contact-info__value" target="_blank" rel="noopener">Join Our Server</a>
                </div>
              </div>
            </div>

            {/* Right Column: Contact Form */}
            <div className="contact-form-wrapper reveal-right">
              <form className="contact-form" action="#" method="post">
                <div className="form-group">
                  <label htmlFor="contact-name">Name</label>
                  <input type="text" id="contact-name" name="name" className="form-input" placeholder="Your name" required />
                </div>
                <div className="form-group">
                  <label htmlFor="contact-email">Email</label>
                  <input type="email" id="contact-email" name="email" className="form-input" placeholder="your@email.com" required />
                </div>
                <div className="form-group">
                  <label htmlFor="contact-subject">Subject</label>
                  <select id="contact-subject" name="subject" className="form-input" required>
                    <option value="">Select a subject</option>
                    <option value="general">General Inquiry</option>
                    <option value="systems">Betting Systems</option>
                    <option value="products">Products &amp; Memberships</option>
                    <option value="support">Technical Support</option>
                    <option value="partnership">Partnership / Collaboration</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="contact-message">Message</label>
                  <textarea id="contact-message" name="message" className="form-input" placeholder="How can we help?" required></textarea>
                </div>
                <button type="submit" className="btn btn--primary">Send Message</button>
              </form>
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
