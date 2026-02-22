import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact Us – EdTheStatMan.com',
  description: 'Get in touch via email, Telegram, or Discord. We typically respond within 24–48 hours.',
}

export default function Contact() {
  return (
    <main>
      <header className="page-header">
        <div className="container">
          <div className="reveal">
            <span className="section-label">Get in Touch</span>
            <h1 className="page-header__title">Contact Us</h1>
            <p className="page-header__subtitle">Have a question about our betting systems, products, or services? Reach out and we&apos;ll get back to you as soon as possible.</p>
          </div>
        </div>
      </header>
      {/* Add contact form content here */}
    </main>
  )
}
