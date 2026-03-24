'use client'

import { useState } from 'react'

type Status = 'idle' | 'sending' | 'success' | 'error'

export default function ContactForm() {
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('sending')
    setErrorMsg('')

    const form = e.currentTarget
    const data = {
      name:    (form.elements.namedItem('name')    as HTMLInputElement).value,
      email:   (form.elements.namedItem('email')   as HTMLInputElement).value,
      subject: (form.elements.namedItem('subject') as HTMLSelectElement).value,
      message: (form.elements.namedItem('message') as HTMLTextAreaElement).value,
    }

    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (res.ok) {
      setStatus('success')
      form.reset()
    } else {
      const body = await res.json().catch(() => ({}))
      setErrorMsg(body.error ?? 'Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>&#10003;</div>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', color: 'var(--accent-cyan)', marginBottom: '8px' }}>Message Sent!</h3>
        <p style={{ color: 'var(--text-secondary)' }}>Thanks for reaching out. We&apos;ll get back to you within 24–48 hours.</p>
        <button
          className="btn btn--secondary btn--sm"
          style={{ marginTop: '24px' }}
          onClick={() => setStatus('idle')}
        >
          Send Another Message
        </button>
      </div>
    )
  }

  return (
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
  )
}
