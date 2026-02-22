'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'

export default function Hero() {
  const particlesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!particlesRef.current) return

    const particleCount = 30
    const colors = ['#34d399', '#6ee7b7', '#818cf8', '#06b6d4']

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div')
      particle.className = 'hero__particle'
      particle.style.left = Math.random() * 100 + '%'
      particle.style.animationDelay = Math.random() * 8 + 's'
      particle.style.animationDuration = (6 + Math.random() * 6) + 's'
      particle.style.width = (2 + Math.random() * 4) + 'px'
      particle.style.height = particle.style.width
      particle.style.opacity = String(0.1 + Math.random() * 0.3)
      particle.style.background = colors[Math.floor(Math.random() * colors.length)]
      particlesRef.current.appendChild(particle)
    }
  }, [])

  return (
    <section className="hero">
      <div className="hero__bg">
        <div className="hero__particles" ref={particlesRef}></div>
        <div className="hero__gradient"></div>
      </div>

      <div className="container">
        <div className="hero__content">
          <div className="hero__badge">
            <span className="pulse-dot"></span>
            Systems Active &mdash; Basketball Season
          </div>

          <h1 className="hero__title">
            Winning Trends.<br />
            <span className="accent">Proven Systems.</span>
          </h1>

          <p className="hero__description">
            Where handicappers get sharp and bettors win. Data-driven betting systems
            and trends backed by deep statistical analysis.
          </p>

          <div className="hero__actions">
            <Link href="/betting-systems" className="btn btn--primary btn--lg">
              <span className="btn__icon">&#128202;</span> View Betting Systems
            </Link>
            <a href="#todays-action" className="btn btn--secondary btn--lg">
              Today&apos;s Action &#8595;
            </a>
          </div>

          <div className="hero__stats">
            <div className="hero__stat">
              <div className="hero__stat-value" data-count="10.19" data-prefix="+" data-suffix="%" data-decimals="2">0%</div>
              <div className="hero__stat-label">2026 Bankroll</div>
            </div>
            <div className="hero__stat">
              <div className="hero__stat-value" data-count="19" data-suffix="-4">0</div>
              <div className="hero__stat-label">Super Bowl LX Systems</div>
            </div>
            <div className="hero__stat">
              <div className="hero__stat-value" data-count="4" data-suffix=" Sports">0</div>
              <div className="hero__stat-label">Active Leagues</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
