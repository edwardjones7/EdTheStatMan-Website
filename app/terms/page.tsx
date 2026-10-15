import type { Metadata } from 'next'
import Link from 'next/link'
import LegalPage from '@/components/LegalPage'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms for using EdTheStatMan.com, including membership, billing and our no-refund policy.',
  alternates: { canonical: 'https://edthestatman.com/terms' },
}

export default function TermsPage() {
  return (
    <LegalPage label="Legal" title="Terms of Service" updated="October 15, 2026">
      <p>
        These terms cover your use of EdTheStatMan.com (&ldquo;the site&rdquo;), operated by
        EdTheStatMan in New Jersey (&ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an account or
        buying a membership you agree to them.
      </p>

      <h2>What we provide</h2>
      <p>
        The site publishes sports betting research: model picks, betting systems, team trends,
        game schedules and lines, and articles. All of it is <strong>information and
        entertainment</strong>. It is not financial, legal or professional advice.
      </p>
      <p>
        <strong>We are not a sportsbook.</strong> We do not take bets, hold funds or pay out
        winnings, and nothing on the site is an offer to place a wager.
      </p>

      <h2>No guarantees</h2>
      <p>
        Sports outcomes are uncertain. No pick, system or trend is guaranteed to win, and past
        results, including the records shown on the site, do not predict future results. Any bet
        you place is your own decision and your own risk. Never bet more than you can afford to
        lose.
      </p>

      <h2>Who can use the site</h2>
      <p>
        You must be at least 21 years old. Sports betting is legal only in some places. It is your
        responsibility to know and follow the laws where you are before acting on anything you
        read here.
      </p>

      <h2>Accounts</h2>
      <p>
        Keep your login to yourself. A membership is for one person: sharing an account, or
        republishing or reselling picks and research from paid areas of the site, is not allowed
        and may lead to the account being closed without a refund.
      </p>

      <h2>Memberships and billing</h2>
      <ul>
        <li>
          <strong>Season passes and The Portfolio</strong> are one-time payments. They give access
          until the end date stated on the plan (season passes run through the Super Bowl) and do not renew.
        </li>
        <li>
          <strong>Monthly plans</strong> on The Research Desk and above renew automatically every
          month at the price shown at checkout until you cancel. You can cancel at any time from
          your account page; access continues to the end of the period you have paid for.
        </li>
        <li>Payments are processed by Stripe. We never see or store your full card number.</li>
      </ul>

      <h2>All sales are final</h2>
      <p>
        Because picks and research are delivered the moment you join, <strong>we do not offer
        refunds</strong> on any purchase, including one-time passes, monthly renewals and unused
        time. Cancelling a monthly plan stops future charges; it does not refund the current
        period. If you believe you were charged in error, <Link href="/contact">contact us</Link>{' '}
        and we will look into it.
      </p>

      <h2>Our content</h2>
      <p>
        Everything on the site belongs to EdTheStatMan. You may use it for your own betting
        decisions. You may not copy, scrape, redistribute or sell it without written permission.
      </p>

      <h2>Limits of liability</h2>
      <p>
        The site is provided &ldquo;as is&rdquo;. To the fullest extent the law allows, we are not
        liable for any betting losses or for indirect or consequential damages arising from your
        use of the site, and our total liability to you is limited to the amount you paid us in the
        twelve months before the claim.
      </p>

      <h2>Changes and governing law</h2>
      <p>
        We may update these terms; the date at the top shows the latest version. These terms are
        governed by the laws of the State of New Jersey.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <Link href="/contact">contact us</Link>. See also our{' '}
        <Link href="/privacy">Privacy Policy</Link> and{' '}
        <Link href="/responsible-gaming">Responsible Gaming</Link> page.
      </p>
    </LegalPage>
  )
}
