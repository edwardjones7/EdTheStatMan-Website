export default function CTASection() {
  return (
    <section className="cta-section">
      <div className="container">
        <div className="cta-box reveal-scale">
          <h2 className="cta-box__title">
            Get Every Pick. <span className="text-gradient">Never Miss an Edge.</span>
          </h2>
          <p className="cta-box__text">
            Join our Telegram channel for instant notifications on all betting systems, picks, and trend alerts.
          </p>
          <div className="cta-box__actions">
            <a href="https://t.me/edthestatman" className="btn btn--primary btn--lg" target="_blank" rel="noopener">
              <span className="btn__icon">&#9889;</span> Join Telegram
            </a>
            <a href="https://discord.gg/gqPrVBg4Aw" className="btn btn--secondary btn--lg" target="_blank" rel="noopener">
              <span className="btn__icon">&#128172;</span> Join Discord
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
