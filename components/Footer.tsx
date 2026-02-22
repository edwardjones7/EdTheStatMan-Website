import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div className="footer__brand">
            <Link href="/" className="nav__logo">
              <div className="nav__logo-icon">E</div>
              <span>EdTheStatMan</span>
            </Link>
            <p>Data-driven betting systems and trends. Where handicappers get sharp and bettors win.</p>
            <div className="social-strip">
              <a href="https://t.me/edthestatman" className="social-link" target="_blank" rel="noopener" aria-label="Telegram">&#9889;</a>
              <a href="https://discord.gg/gqPrVBg4Aw" className="social-link" target="_blank" rel="noopener" aria-label="Discord">&#128172;</a>
            </div>
          </div>

          <div>
            <h4 className="footer__heading">Navigation</h4>
            <div className="footer__links">
              <Link href="/" className="footer__link">Today&apos;s Action</Link>
              <Link href="/betting-systems" className="footer__link">Betting Systems</Link>
              <Link href="/betting-trends" className="footer__link">Betting Trends</Link>
              <Link href="/blog" className="footer__link">Blog</Link>
            </div>
          </div>

          <div>
            <h4 className="footer__heading">Resources</h4>
            <div className="footer__links">
              <Link href="/results" className="footer__link">Results</Link>
              <Link href="/contact" className="footer__link">Contact</Link>
              <Link href="/betting-systems" className="footer__link">Memberships</Link>
            </div>
          </div>

          <div>
            <h4 className="footer__heading">Sportsbooks</h4>
            <div className="footer__links">
              <a href="#" className="footer__link">DraftKings</a>
              <a href="#" className="footer__link">FanDuel</a>
              <a href="#" className="footer__link">BetMGM</a>
              <a href="#" className="footer__link">Caesars</a>
            </div>
          </div>
        </div>

        <div className="footer__bottom">
          <span className="footer__copyright">&copy; 2026 EdTheStatMan.com. All rights reserved.</span>
          <div className="footer__legal">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
