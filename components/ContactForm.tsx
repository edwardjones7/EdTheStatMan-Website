'use client'

import { useState } from 'react'

type Status = 'idle' | 'sending' | 'success' | 'error'

export default function ContactForm() {
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const form = e.currentTarget
    const name    = (form.elements.namedItem('name')    as HTMLInputElement).value
    const email   = (form.elements.namedItem('email')   as HTMLInputElement).value
    const subject = (form.elements.namedItem('subject') as HTMLSelectElement).value
    const message = (form.elements.namedItem('message') as HTMLTextAreaElement).value

    const subjectLabels: Record<string, string> = {
      general: 'General Inquiry',
      systems: 'Betting Systems',
      products: 'Products & Memberships',
      support: 'Technical Support',
      partnership: 'Partnership / Collaboration',
      other: 'Other',
    }

    const subjectLine = `[Contact] ${subjectLabels[subject] ?? subject} — ${name}`
    const body = `Name: ${name}\nEmail: ${email}\nSubject: ${subjectLabels[subject] ?? subject}\n\n${message}`

    window.location.href = `mailto:ed@edthestatman.com?subject=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(body)}`

    setStatus('success')
    form.reset()
  }

  return (
    <>
      <form className="contact-form" onSubmit={handleSubmit}>
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
          <textarea id="contact-message" name="message" className="form-input" placeholder="How can we help?" required />
        </div>
        {status === 'error' && (
          <p style={{ color: 'var(--accent-red)', fontSize: '0.875rem', margin: '-8px 0 8px' }}>{errorMsg}</p>
        )}
        <button type="submit" className="btn btn--primary" disabled={status === 'sending'}>
          {status === 'sending' ? 'Sending…' : 'Send Message'}
        </button>
      </form>

      {/* Success modal */}
      {status === 'success' && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px',
          }}
          onClick={() => setStatus('idle')}
        >
          <div
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-color)',
              borderRadius: '20px', padding: '40px 36px', maxWidth: '420px', width: '100%',
              textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: '1.5rem', color: 'var(--accent-cyan)',
            }}>
              ✓
            </div>
            <h3 style={{
              fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 700,
              color: 'var(--text-heading)', margin: '0 0 10px',
            }}>
              Message Sent!
            </h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 28px' }}>
              Thanks for reaching out. We&apos;ll get back to you within 24–48 hours.
            </p>
            <button className="btn btn--primary btn--sm" onClick={() => setStatus('idle')}>
              Done
            </button>
          </div>
        </div>
      )}
    </>
  )
}
