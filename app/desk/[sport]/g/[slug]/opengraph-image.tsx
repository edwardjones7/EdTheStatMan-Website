import { ImageResponse } from 'next/og'
import { createCachedClient, DB_TAGS } from '@/lib/supabase/cached'
import { decodeSlugParam, spreadLabel } from '@/lib/nfl'
import { deskSportLabel, weeksFromDates } from '@/lib/desk'
import { logoDataUrl } from '@/lib/og-logo'

// The share card for a Desk game: both teams, the spread, the total and the
// kickoff. Public market data only, the same numbers the page shows everyone;
// nothing gated (the write-up, the linked Vault rows, the bets) is read here.

// Edge: the node build of next/og cannot find its bundled font on Windows
// in dev (a file-URL bug in Next 14), and the edge build is the documented default.
export const runtime = 'edge'
export const alt = 'Matchup, spread and total on the EdTheStatMan Research Desk'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const BG = '#0A101B'
const CARD = '#111A28'
const BORDER = '#22314A'
const BRAND = '#2F7BFF'
const BRAND_TEXT = '#6AA5FF'
const HEADING = '#F4F7FB'
const MUTED = '#8A99B0'

const COLUMNS =
  'sport, slug, is_published, status, kickoff, home_team, away_team, home_abbrev, away_abbrev, ' +
  'home_score, away_score, spread_open, spread_current, total_open, total_current'

function kickoffText(kickoff: string | null, sport: string): string {
  if (!kickoff) return weeksFromDates(sport) ? 'Tip-off TBD' : 'Kickoff TBD'
  return new Date(kickoff).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short',
  })
}

function Team({ abbrev, name, logo }: { abbrev: string; name: string; logo: string | null }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 380 }}>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} width={170} height={170} alt="" style={{ objectFit: 'contain' }} />
      ) : (
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 170, height: 170, borderRadius: 24, background: CARD,
            border: `2px solid ${BORDER}`, color: HEADING, fontSize: 52, fontWeight: 700,
          }}
        >
          {abbrev}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 96, marginTop: 16, color: HEADING, fontSize: 40, fontWeight: 700, textAlign: 'center', lineHeight: 1.1 }}>
        {name}
      </div>
      <div style={{ display: 'flex', marginTop: 6, color: MUTED, fontSize: 26, letterSpacing: 2 }}>{abbrev}</div>
    </div>
  )
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '14px 30px', borderRadius: 16, background: CARD, border: `2px solid ${BORDER}`,
        minWidth: 230,
      }}
    >
      <div style={{ display: 'flex', color: MUTED, fontSize: 20, letterSpacing: 3 }}>{label}</div>
      <div style={{ display: 'flex', color: HEADING, fontSize: 40, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  )
}

function Fallback() {
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', background: BG, alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <div style={{ display: 'flex', color: BRAND_TEXT, fontSize: 30, letterSpacing: 6 }}>THE RESEARCH DESK</div>
        <div style={{ display: 'flex', color: HEADING, fontSize: 72, fontWeight: 700, marginTop: 12 }}>EdTheStatMan.com</div>
      </div>
    ),
    size
  )
}

export default async function Image({ params }: { params: { sport: string; slug: string } }) {
  const sport = params.sport.toLowerCase()
  let game: any = null
  try {
    const { data } = await (createCachedClient([DB_TAGS.games]) as any)
      .from('nfl_games')
      .select(COLUMNS)
      .eq('sport', sport)
      .eq('slug', decodeSlugParam(params.slug))
      .maybeSingle()
    game = data
  } catch {
    game = null
  }
  if (!game || !game.is_published) return Fallback()

  const [awayLogo, homeLogo] = await Promise.all([
    logoDataUrl(sport, game.away_abbrev),
    logoDataUrl(sport, game.home_abbrev),
  ])

  const spread = spreadLabel(game.spread_current ?? game.spread_open, game.home_abbrev, game.away_abbrev)
  const total = game.total_current ?? game.total_open
  const final = game.status === 'post' && game.home_score != null && game.away_score != null
  const when = final
    ? `Final: ${game.away_abbrev} ${game.away_score}, ${game.home_abbrev} ${game.home_score}`
    : game.status === 'in' ? 'Live now' : kickoffText(game.kickoff, sport)

  return new ImageResponse(
    (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: BG, padding: '44px 56px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', width: 14, height: 40, background: BRAND, borderRadius: 3, marginRight: 16 }} />
            <div style={{ display: 'flex', color: BRAND_TEXT, fontSize: 28, letterSpacing: 5, fontWeight: 700 }}>
              {`${deskSportLabel(sport).toUpperCase()} · RESEARCH DESK`}
            </div>
          </div>
          <div style={{ display: 'flex', color: MUTED, fontSize: 26 }}>EdTheStatMan.com</div>
        </div>

        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Team abbrev={game.away_abbrev} name={game.away_team} logo={awayLogo} />
          <div style={{ display: 'flex', color: MUTED, fontSize: 56, fontWeight: 700, width: 120, justifyContent: 'center' }}>@</div>
          <Team abbrev={game.home_abbrev} name={game.home_team} logo={homeLogo} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex' }}>
            <Chip label="SPREAD" value={spread ? spread.replace(/-/g, '−') : '—'} />
            <div style={{ display: 'flex', width: 18 }} />
            <Chip label="TOTAL" value={total != null ? `O/U ${total}` : '—'} />
          </div>
          <div style={{ display: 'flex', color: HEADING, fontSize: 30, fontWeight: 700 }}>{when}</div>
        </div>
      </div>
    ),
    size
  )
}
