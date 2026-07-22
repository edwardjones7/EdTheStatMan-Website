import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'EdTheStatMan – Winning Sports Betting Picks, Systems & Trends'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(180deg, #071219 0%, #0c1e28 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '36px' }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #a8e063 0%, #2dd4bf 55%, #38bdf8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '40px',
              fontWeight: 800,
              color: '#071219',
            }}
          >
            E
          </div>
          <span style={{ fontSize: '40px', fontWeight: 700, color: '#ffffff' }}>
            EdTheStatMan
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: '58px',
            fontWeight: 800,
            color: '#ffffff',
            textAlign: 'center',
            lineHeight: 1.15,
            marginBottom: '12px',
          }}
        >
          Winning Sports Betting
        </div>
        <div
          style={{
            fontSize: '58px',
            fontWeight: 800,
            color: '#2dd4bf',
            textAlign: 'center',
            lineHeight: 1.15,
            marginBottom: '32px',
          }}
        >
          Picks, Systems & Trends
        </div>

        {/* Subtext */}
        <div
          style={{
            fontSize: '26px',
            color: '#9ca3af',
            textAlign: 'center',
          }}
        >
          Data-driven edge for NFL · NBA · College Football · College Basketball
        </div>
      </div>
    ),
    { ...size }
  )
}
