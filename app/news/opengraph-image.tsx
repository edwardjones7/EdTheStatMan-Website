import { ImageResponse } from 'next/og'

// The share card for /news: a generic Wire card. Static content on purpose, so
// a share costs no database or feed read.

// Edge: the node build of next/og cannot find its bundled font on Windows
// in dev (a file-URL bug in Next 14), and the edge build is the documented default.
export const runtime = 'edge'
export const alt = 'The Wire on EdTheStatMan.com: injuries, line moves and game previews'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const BG = '#0A101B'
const CARD = '#111A28'
const BORDER = '#22314A'
const BRAND = '#2F7BFF'
const BRAND_TEXT = '#6AA5FF'
const HEADING = '#F4F7FB'
const MUTED = '#8A99B0'
const DOWN = '#FF6B6B'

function Row({ tag, tone, text }: { tag: string; tone: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '16px 22px', borderTop: `2px solid ${BORDER}` }}>
      <div style={{ display: 'flex', color: tone, fontSize: 22, fontWeight: 700, letterSpacing: 3, width: 150 }}>{tag}</div>
      <div style={{ display: 'flex', color: HEADING, fontSize: 28 }}>{text}</div>
    </div>
  )
}

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: BG, padding: '52px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', width: 14, height: 40, background: BRAND, borderRadius: 3, marginRight: 16 }} />
          <div style={{ display: 'flex', color: BRAND_TEXT, fontSize: 28, letterSpacing: 5, fontWeight: 700 }}>THE WIRE</div>
        </div>
        <div style={{ display: 'flex', color: HEADING, fontSize: 60, fontWeight: 700, marginTop: 18, lineHeight: 1.05 }}>
          Injuries, line moves and game previews
        </div>
        <div style={{ display: 'flex', color: MUTED, fontSize: 24, marginTop: 12, marginBottom: 24 }}>
          NFL · College Football · NBA · College Basketball, with the market on every story
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto', background: CARD, border: `2px solid ${BORDER}`, borderRadius: 18 }}>
          <div style={{ display: 'flex', padding: '14px 22px', color: MUTED, fontSize: 22, letterSpacing: 3 }}>ON THE WIRE</div>
          <Row tag="INJURY" tone={DOWN} text="Key players listed out or doubtful, before kickoff" />
          <Row tag="LINE" tone={BRAND_TEXT} text="Spreads and totals that moved since the open" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', color: MUTED, fontSize: 24, marginTop: 18 }}>EdTheStatMan.com/news</div>
      </div>
    ),
    size
  )
}
