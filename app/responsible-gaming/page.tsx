import type { Metadata } from 'next'
import Link from 'next/link'
import LegalPage from '@/components/LegalPage'

export const metadata: Metadata = {
  title: 'Responsible Gaming',
  description: 'Betting should be entertainment. Where to get help if it stops being fun: 1-800-GAMBLER.',
  alternates: { canonical: 'https://edthestatman.com/responsible-gaming' },
}

export default function ResponsibleGamingPage() {
  return (
    <LegalPage label="Play Smart" title="Responsible Gaming" updated="October 15, 2026">
      <p>
        Everything on EdTheStatMan.com is research for adults 21 and over. Betting should be
        entertainment, never a way to make money you need or to win back losses.
      </p>

      <h2>Help is available</h2>
      <p>
        If gambling has stopped being fun for you or someone close to you, free and confidential
        help is available 24/7:
      </p>
      <ul>
        <li>
          Call or text <strong><a href="tel:18004262537">1-800-GAMBLER</a></strong> (1-800-426-2537)
        </li>
        <li>
          <a href="https://www.ncpgambling.org" target="_blank" rel="noopener">
            National Council on Problem Gambling
          </a>
        </li>
        <li>
          <a href="https://www.800gambler.org" target="_blank" rel="noopener">
            Council on Compulsive Gambling of New Jersey
          </a>
        </li>
      </ul>

      <h2>Keep it in bounds</h2>
      <ul>
        <li>Set a budget before you bet, and stop when it is gone.</li>
        <li>Bet a small, fixed share of your bankroll on any one play.</li>
        <li>Never chase losses or bet with money meant for bills.</li>
        <li>No pick is a lock. Every bet can lose, no matter how good the record behind it.</li>
        <li>Take breaks. Most sportsbooks let you set deposit limits or exclude yourself.</li>
      </ul>

      <h2>Bet legally</h2>
      <p>
        Sports betting is legal only in some states. Use licensed sportsbooks where you live and
        know your local rules. We are not a sportsbook and do not take bets.
      </p>

      <p>
        See also our <Link href="/terms">Terms of Service</Link>.
      </p>
    </LegalPage>
  )
}
