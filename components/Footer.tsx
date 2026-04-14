import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div className="footer__brand">
            <Link href="/" className="nav__logo">
              <div className="nav__logo-icon"><svg viewBox="0 0 32 32" width="100%" height="100%"><defs><linearGradient id="footer-logo-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#34d399"/><stop offset="100%" stopColor="#06b6d4"/></linearGradient></defs><rect width="32" height="32" rx="4" fill="#0f172a"/><path d="M7 5 L25 5 L23 9 L11 9 L11 14 L22 14 L20.5 18 L11 18 L11 23 L25 23 L23 27 L7 27 Z" fill="url(#footer-logo-g)"/></svg></div>
              <span>EdTheStatMan</span>
            </Link>
            <p>Data-driven betting systems and trends. Where handicappers get sharp and bettors win.</p>
            <div className="social-strip">
              <a href="https://discord.gg/gqPrVBg4Aw" className="social-link" target="_blank" rel="noopener" aria-label="Discord">
                {/* Discord */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </a>
              <a href="https://x.com/EdTheStatMan" className="social-link" target="_blank" rel="noopener" aria-label="X / Twitter">
                {/* X / Twitter */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
            </div>
          </div>

          <div>
            <h4 className="footer__heading">Navigation</h4>
            <div className="footer__links">
              <Link href="/model-picks" className="footer__link">Today&apos;s Action</Link>
              <Link href="/betting-systems" className="footer__link">Betting Systems</Link>
              <Link href="/betting-trends" className="footer__link">Betting Trends</Link>
              <Link href="/blog" className="footer__link">Blog</Link>
            </div>
          </div>

          <div>
            <h4 className="footer__heading">Resources</h4>
            <div className="footer__links">
              <Link href="/results" className="footer__link">Results</Link>
              <Link href="/pricing" className="footer__link">Pricing</Link>
              <Link href="/contact" className="footer__link">Contact</Link>
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
