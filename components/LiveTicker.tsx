'use client'

import { useEffect } from 'react'

export default function LiveTicker() {
  useEffect(() => {
    const track = document.querySelector('.ticker__track')
    if (track) {
      const items = track.innerHTML
      track.innerHTML = items + items
    }
  }, [])

  return (
    <div className="ticker">
      <div className="ticker__track">
        <div className="ticker__item">
          <span className="ticker__sport">NFL</span>
          <span className="ticker__record">Betting Systems: 10-34</span>
        </div>
        <div className="ticker__item">
          <span className="ticker__sport">College Football</span>
          <span className="ticker__record">Betting Systems: 3-3</span>
        </div>
        <div className="ticker__item">
          <span className="ticker__sport">NBA</span>
          <span className="ticker__record">Betting Systems: 101-108</span>
        </div>
        <div className="ticker__item">
          <span className="ticker__sport">College Basketball</span>
          <span className="ticker__record">Betting Systems: 2-0</span>
          <span className="ticker__trend ticker__trend--up">&#9650; Hot</span>
        </div>
        <div className="ticker__item">
          <span className="ticker__sport">Bankroll</span>
          <span className="ticker__record">+10.19% in 2026</span>
          <span className="ticker__trend ticker__trend--up">&#9650;</span>
        </div>
        <div className="ticker__item">
          <span className="ticker__sport">Super Bowl LX</span>
          <span className="ticker__record">Systems: 19-4 ATS</span>
          <span className="ticker__trend ticker__trend--up">&#9989; Winner</span>
        </div>
      </div>
    </div>
  )
}
