import type { Metadata } from 'next'
import Link from 'next/link'
import LegalPage from '@/components/LegalPage'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'What EdTheStatMan.com collects, why, and who it is shared with.',
  alternates: { canonical: 'https://edthestatman.com/privacy' },
}

// Written against what the code actually does (lib/analytics.ts,
// lib/attribution.ts, app/api/track, lib/notify). If any of those change what
// they collect, this page has to change with them.
export default function PrivacyPage() {
  return (
    <LegalPage label="Legal" title="Privacy Policy" updated="October 15, 2026">
      <p>
        This explains what EdTheStatMan.com collects, why, and who it is shared with. We do not
        sell your personal information.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Your account:</strong> your email address and name, or the details Google shares
          if you sign in with Google, plus your membership level and its dates.
        </li>
        <li>
          <strong>Payments:</strong> handled by Stripe. We keep a record of what you bought and
          when, and a Stripe customer reference. We never receive your full card number.
        </li>
        <li>
          <strong>Site usage:</strong> pages viewed, the referring site, any campaign tags in the
          link you arrived on, device type, browser and country. Visitors who are not signed in are
          counted with an anonymous identifier that changes every day, so a visit cannot be tied to
          you across days. If you are signed in, page views are linked to your account.
        </li>
        <li>
          <strong>How you found us:</strong> the first link that brought you to the site is kept in
          your browser and saved to your account when you sign up or buy, so we can tell which
          channels work.
        </li>
        <li>
          <strong>Alerts you turn on:</strong> your browser&rsquo;s push subscription if you enable
          push notifications, and your Discord user ID if you link Discord.
        </li>
        <li>
          <strong>Messages:</strong> anything you send through the contact form.
        </li>
      </ul>

      <h2>Cookies</h2>
      <p>
        We use cookies only to keep you signed in. Usage counting does not use cookies.
      </p>

      <h2>How we use it</h2>
      <p>
        To run your account and membership, deliver the picks and alerts you ask for, answer your
        messages, protect the site against abuse and bots, and understand which pages and channels
        bring people to the site.
      </p>

      <h2>Who we share it with</h2>
      <p>Only the services that run the site, each for its own part:</p>
      <ul>
        <li>Supabase (database and sign-in)</li>
        <li>Vercel (hosting, performance analytics and bot protection)</li>
        <li>Stripe (payments)</li>
        <li>Resend (email delivery)</li>
        <li>Discord (only if you link your account)</li>
        <li>Google (only if you sign in with Google)</li>
      </ul>
      <p>We may also disclose information when the law requires it.</p>

      <h2>Email</h2>
      <p>
        Pick alerts by email can be turned off from your account page or with the unsubscribe link
        in any alert. Account and billing emails are sent regardless, because they concern your
        purchase.
      </p>

      <h2>Your choices</h2>
      <p>
        You can update your name and email from your account page. To get a copy of your data or
        have your account deleted, <Link href="/contact">contact us</Link>. We keep payment records
        as long as tax and accounting rules require.
      </p>

      <h2>Children</h2>
      <p>The site is for adults 21 and over and is not directed at anyone younger.</p>

      <h2>Changes</h2>
      <p>
        We may update this policy; the date at the top shows the latest version. Questions:{' '}
        <Link href="/contact">contact us</Link>.
      </p>
    </LegalPage>
  )
}
