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
          background: '#0f1117',
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
              borderRadius: '50%',
              background: '#34d399',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              fontWeight: 700,
              color: '#0f1117',
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
            color: '#34d399',
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
