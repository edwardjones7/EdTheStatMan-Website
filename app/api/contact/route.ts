import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  const { name, email, subject, message } = await request.json()

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
  }

  const subjectLabels: Record<string, string> = {
    general: 'General Inquiry',
    systems: 'Betting Systems',
    products: 'Products & Memberships',
    support: 'Technical Support',
    partnership: 'Partnership / Collaboration',
    other: 'Other',
  }

  const { error } = await resend.emails.send({
    from: 'EdTheStatMan Contact Form <onboarding@resend.dev>',
    to: 'ed@edthestatman.com',
    replyTo: email,
    subject: `[Contact] ${subjectLabels[subject] ?? subject} — ${name}`,
    text: `Name: ${name}\nEmail: ${email}\nSubject: ${subjectLabels[subject] ?? subject}\n\n${message}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#34d399;margin-bottom:4px">New Contact Form Submission</h2>
        <hr style="border:none;border-top:1px solid #333;margin:16px 0"/>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
        <p><strong>Subject:</strong> ${subjectLabels[subject] ?? subject}</p>
        <hr style="border:none;border-top:1px solid #333;margin:16px 0"/>
        <p style="white-space:pre-wrap">${message}</p>
      </div>
    `,
  })

  if (error) {
    console.error('Resend error:', error)
    return NextResponse.json({ error: 'Failed to send message. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
