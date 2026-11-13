import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { createCachedClient, DB_TAGS } from '@/lib/supabase/cached'
import { toPublicGame, gamePath, weekLabel } from '@/lib/nfl'
import type { PublicNflGame, NflGame } from '@/lib/nfl'
import { spreadLabel } from '@/lib/nfl'
import { DESK_SPORTS, deskSportLabel, deskSeasonLabel, weeksFromDates } from '@/lib/desk'
import {
  teamSeasonSummary, teamAtsResult, teamSuResult, ouResult, teamLine, signedLine, recordText,
} from '@/lib/ats'
import type { TeamSeasonSummary } from '@/lib/ats'
import { abbrevFromParam, latestPublishedSeason, teamSeasonGames, teamShortName, teamPath } from '@/lib/desk-teams'
import { teamLogoUrl } from '@/lib/logos'
import { loadInjuries, type Injury } from '@/lib/feeds/injuries'
import { loadWire, type WireItem } from '@/lib/wire'
import { buildPreview } from '@/lib/preview'
import { LIVE_SPORTS, type LiveSport } from '@/lib/live/types'
import '@/styles/seo-desk.css'
import '@/styles/team-hub.css'

export const dynamic = 'force-dynamic'

const BASE = 'https://edthestatman.com'

interface TeamData {
  sport: string
  abbrev: string
  season: number
  fullName: string
  shortName: string
  games: PublicNflGame[]
  summary: TeamSeasonSummary
}

/**
 * One read shared by generateMetadata and the page. React's cache() lives for
 * the request, so the title and the body cost one set of queries, not two.
 *
 * Only the newest PUBLISHED season, and only teams that appear in it: a team
 * with no published game this season is a 404, never an empty schedule, so the
 * sitemap and the pages always agree on which teams exist.
 */
const loadTeam = cache(async (sportParam: string, abbrevParam: string): Promise<TeamData | null> => {
  const sport = sportParam.toLowerCase()
  if (!DESK_SPORTS.includes(sport as any)) return null
  const abbrev = abbrevFromParam(abbrevParam)
  if (!abbrev) return null

  const admin = createCachedClient([DB_TAGS.games])
  const season = await latestPublishedSeason(admin, sport)
  const rows = await teamSeasonGames(admin, sport, season, abbrev)
  if (rows.length === 0) return null

  // toPublicGame copies fields one at a time, so writeup_html is gone from here on.
  const games = rows.map(toPublicGame)
  // The name comes off the schedule row, latest game first, so a rename upstream
  // shows the current name rather than whichever row happened to load first.
  const last = games[games.length - 1]
  const fullName = last.home_abbrev === abbrev ? last.home_team : last.away_team
  return {
    sport,
    abbrev,
    season,
    fullName,
    shortName: teamShortName(sport, abbrev, fullName),
    games,
    summary: teamSeasonSummary(games, abbrev),
  }
})

export async function generateMetadata(
  { params }: { params: { sport: string; abbrev: string } }
): Promise<Metadata> {
  const t = await loadTeam(params.sport, params.abbrev)
  if (!t) return { title: 'Team Not Found' }

  const seasonLabel = deskSeasonLabel(t.sport, t.season)
  // `absolute` so the root template does not append its own brand a second time.
  const title = `${t.fullName} ATS Record & ${seasonLabel} Schedule | EdTheStatMan`
  const s = t.summary
  const records = s.finals > 0
    ? ` ${recordText(s.su.w, s.su.l, s.su.t)} straight up, ${recordText(s.ats.w, s.ats.l, s.ats.p)} against the spread and ${recordText(s.ou.o, s.ou.u, s.ou.p)} on totals so far.`
    : ''
  const description = `The ${t.fullName} ${seasonLabel} ${deskSportLabel(t.sport)} schedule with every closing spread and total, and each result against the spread.${records}`
  const url = `${BASE}${teamPath(t.sport, t.abbrev)}`
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: 'EdTheStatMan', images: [{ url: '/og-cover.jpg', width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title, description, images: ['/og-cover.jpg'] },
  }
}

const STAT_SPORT: Record<string, string> = {
  nfl: 'American Football',
  cfb: 'American Football',
  nba: 'Basketball',
  cbb: 'Basketball',
}

function dayText(kickoff: string | null): string {
  if (!kickoff) return 'TBD'
  return new Date(kickoff).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York',
  })
}

function kickText(kickoff: string | null, tbd?: boolean | null): string {
  if (!kickoff) return 'Time TBD'
  if (tbd) {
    return `${new Date(kickoff).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York' })}, time TBD`
  }
  return new Date(kickoff).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone: 'America/New_York', timeZoneName: 'short',
  })
}

const minus = (x: string) => x.replace(/-/g, '−')

/**
 * The research count and the bet count for one game, for the preview's last
 * paragraph. Cached reads, same tags the Desk board uses; COUNTS only, the
 * links themselves are what the Desk sells and never leave the server. Either
 * read failing (a column not migrated yet) is a zero, not an error.
 */
async function researchCounts(gameId: string): Promise<{ linked: number; bets: number }> {
  try {
    const games = createCachedClient([DB_TAGS.games]) as any
    const picks = createCachedClient([DB_TAGS.picks]) as any
    const [sys, trends, bets] = await Promise.all([
      games.from('nfl_game_systems').select('game_id').eq('game_id', gameId),
      games.from('nfl_game_trends').select('game_id').eq('game_id', gameId),
      picks.from('todays_bets').select('game_id, is_active, show_on_results').eq('game_id', gameId),
    ])
    const linked = (sys?.data?.length ?? 0) + (trends?.data?.length ?? 0)
    // Same "is it public" rule as the Desk board: an inactive pick that was
    // never published is still a draft.
    const betRows = ((bets?.data ?? []) as any[]).filter(r => !(r.is_active === false && r.show_on_results !== true))
    return { linked, bets: betRows.length }
  } catch {
    return { linked: 0, bets: 0 }
  }
}

const INJ_CLASS: Record<Injury['status'], string> = {
  Out: 'out', Doubtful: 'doubtful', Questionable: 'q', 'Day-To-Day': 'q',
}
const INJ_SHORT: Record<Injury['status'], string> = {
  Out: 'OUT', Doubtful: 'DBT', Questionable: 'Q', 'Day-To-Day': 'DTD',
}

export default async function DeskTeamPage({ params }: { params: { sport: string; abbrev: string } }) {
  const t = await loadTeam(params.sport, params.abbrev)
  if (!t) notFound()

  const { sport, abbrev, season, games, summary: s } = t
  const league = deskSportLabel(sport)
  const seasonLabel = deskSeasonLabel(sport, season)
  const logo = teamLogoUrl(sport, abbrev)
  const url = `${BASE}${teamPath(sport, abbrev)}`
  const dated = weeksFromDates(sport)
  const live = (LIVE_SPORTS as readonly string[]).includes(sport)

  const stats = [
    { label: 'Straight up', value: recordText(s.su.w, s.su.l, s.su.t), n: s.finals, up: s.su.w > s.su.l },
    { label: 'Against the spread', value: recordText(s.ats.w, s.ats.l, s.ats.p), n: s.ats.w + s.ats.l + s.ats.p, up: s.ats.w > s.ats.l },
    { label: 'Over / under', value: recordText(s.ou.o, s.ou.u, s.ou.p), n: s.ou.o + s.ou.u + s.ou.p, up: false },
  ]

  // Last five finals, newest first.
  const last5 = games.filter(g => g.status === 'post').slice(-5).reverse()
  // The next game: live now, else the first one still to be played.
  const next = games.find(g => g.status === 'in') ?? games.find(g => g.status === 'pre') ?? null
  const nextHome = next ? next.home_abbrev === abbrev : false
  const oppAbbrev = next ? (nextHome ? next.away_abbrev : next.home_abbrev) : null

  // Everything below is public: injuries (status and body part only, never
  // ESPN's written notes), the Wire, and the generated preview. Each source is
  // cached upstream and a failure in any one of them only drops its panel.
  const admin = createCachedClient([DB_TAGS.games])
  const [injuries, wire, oppRows, counts] = await Promise.all([
    live ? loadInjuries(sport as LiveSport).catch(() => ({})) : Promise.resolve({}),
    live ? loadWire().catch(() => [] as WireItem[]) : Promise.resolve([] as WireItem[]),
    next && oppAbbrev && next.status === 'pre'
      ? teamSeasonGames(admin, sport, season, oppAbbrev).catch(() => [] as NflGame[])
      : Promise.resolve([] as NflGame[]),
    next && next.status === 'pre' ? researchCounts(next.id) : Promise.resolve({ linked: 0, bets: 0 }),
  ])
  const report = injuries as Record<string, Injury[]>
  const myInjuries = report[t.fullName] ?? []

  let preview: string[] = []
  if (next && next.status === 'pre') {
    const mine = games as unknown as NflGame[]
    const theirs = oppRows.map(toPublicGame) as unknown as NflGame[]
    const oppName = nextHome ? next.away_team : next.home_team
    preview = buildPreview({
      game: next as unknown as NflGame,
      homeSeason: nextHome ? mine : theirs,
      awaySeason: nextHome ? theirs : mine,
      homeInjuries: nextHome ? myInjuries : report[oppName] ?? [],
      awayInjuries: nextHome ? report[oppName] ?? [] : myInjuries,
      weather: null,
      linkedCount: counts.linked,
      betsCount: counts.bets,
    })
  }

  const teamWire = wire
    .filter(w => w.sport === sport && (w.awayAbbrev === abbrev || w.homeAbbrev === abbrev))
    .slice(0, 6)

  return (
    <main className="th-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SportsTeam',
            name: t.fullName,
            sport: STAT_SPORT[sport] ?? 'Sports',
            memberOf: { '@type': 'SportsOrganization', name: league },
            ...(logo ? { logo } : {}),
            url,
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Research Desk', item: `${BASE}/desk` },
              { '@type': 'ListItem', position: 2, name: league, item: `${BASE}/desk/${sport}` },
              { '@type': 'ListItem', position: 3, name: t.fullName, item: url },
            ],
          }),
        }}
      />

      <div className="container th-wrap">
        <Link href={`/desk/${sport}`} className="th-back">&larr; {league} Desk</Link>

        <header className="th-head">
          <span className="th-head__tile" aria-hidden="true">
            {logo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={logo} alt="" width={88} height={88} decoding="async" className="th-head__logo" />
              : abbrev}
          </span>
          <div className="th-head__text">
            <span className="th-kick">{league} · {seasonLabel}</span>
            <h1 className="th-title">{t.fullName}</h1>
            <p className="th-sub">
              Records, recent results against the spread, injuries and the next game for the {seasonLabel} season.
            </p>
          </div>
          <div className="th-stats" role="list">
            {stats.map(st => (
              <div className="th-stat" role="listitem" key={st.label}>
                <span className={`th-stat__v${st.up && st.n > 0 ? ' is-up' : ''}`}>{st.n > 0 ? st.value : '—'}</span>
                <span className="th-stat__k">{st.label}</span>
              </div>
            ))}
          </div>
        </header>
        {s.finals > 0 && s.ats.w + s.ats.l + s.ats.p < s.finals && (
          <p className="th-note">ATS and totals count only finals with a closing line on file.</p>
        )}

        <div className="th-grid">
          <div className="th-main">
            {next && (
              <section className="th-card" aria-labelledby="th-next">
                <header className="th-hd">
                  <h2 id="th-next">{next.status === 'in' ? 'Live now' : 'Next game'}</h2>
                  <Link href={gamePath(sport, next.slug)}>Game page &rarr;</Link>
                </header>
                <Link href={gamePath(sport, next.slug)} className="th-next">
                  <span className="th-next__teams">
                    <TeamMark sport={sport} abbrev={next.away_abbrev} />
                    <span className="th-next__at">@</span>
                    <TeamMark sport={sport} abbrev={next.home_abbrev} />
                  </span>
                  <span className="th-next__info">
                    <b>{teamShortName(sport, next.away_abbrev, next.away_team)} at {teamShortName(sport, next.home_abbrev, next.home_team)}</b>
                    <small>
                      {next.status === 'in'
                        ? `${next.away_abbrev} ${next.away_score ?? 0}, ${next.home_abbrev} ${next.home_score ?? 0}`
                        : kickText(next.kickoff, next.kickoff_tbd)}
                      {!dated && ` · ${weekLabel(next.season_type, next.week, sport)}`}
                    </small>
                  </span>
                  <span className="th-next__market">
                    {(() => {
                      const sp = spreadLabel(next.spread_current ?? next.spread_open, next.home_abbrev, next.away_abbrev)
                      const tot = next.total_current ?? next.total_open
                      return (
                        <>
                          <span><em>Spread</em>{sp ? minus(sp) : '—'}</span>
                          <span><em>Total</em>{tot != null ? tot : '—'}</span>
                        </>
                      )
                    })()}
                  </span>
                </Link>
                {preview.length > 0 && (
                  <div className="th-preview">
                    {preview.map((p, i) => <p key={i}>{p}</p>)}
                  </div>
                )}
              </section>
            )}

            <section className="th-card" aria-labelledby="th-last5">
              <header className="th-hd">
                <h2 id="th-last5">Last {last5.length || 5} results</h2>
                <small>Against the closing line</small>
              </header>
              {last5.length === 0 ? (
                <p className="th-empty">No finals yet this season.</p>
              ) : (
                <ol className="th-last">
                  {last5.map(g => {
                    const home = g.home_abbrev === abbrev
                    const opp = home ? g.away_abbrev : g.home_abbrev
                    const su = teamSuResult(g, abbrev)
                    const ats = teamAtsResult(g, abbrev)
                    const ou = ouResult(g)
                    const line = teamLine(g, abbrev)
                    const mine = home ? g.home_score : g.away_score
                    const theirs = home ? g.away_score : g.home_score
                    return (
                      <li key={g.id}>
                        <Link href={gamePath(sport, g.slug)} className="th-last__row">
                          <span className="th-last__when">{dayText(g.kickoff)}</span>
                          <span className="th-last__opp">
                            <span className="th-dim">{home ? 'vs' : '@'}</span>{' '}
                            {teamShortName(sport, opp, home ? g.away_team : g.home_team)}
                          </span>
                          <span className="th-last__score">
                            {su && <b className={`team-res team-res--${su}`}>{su}</b>} {mine}-{theirs}
                          </span>
                          <span className="th-last__ats">
                            {line !== null ? minus(signedLine(line)) : '—'}
                            {ats
                              ? <b className={`th-tag th-tag--${ats}`}>{ats === 'W' ? 'Covered' : ats === 'L' ? 'Missed' : 'Push'}</b>
                              : <b className="th-tag">No line</b>}
                          </span>
                          <span className="th-last__ou">
                            {ou ? <b className={`team-res team-res--ou-${ou}`}>{ou === 'over' ? 'Over' : ou === 'under' ? 'Under' : 'Push'}</b> : null}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ol>
              )}
            </section>

            <section className="th-card" aria-labelledby="th-sched">
              <header className="th-hd">
                <h2 id="th-sched">{seasonLabel} schedule</h2>
                <small>{games.length} games</small>
              </header>
              <ol className="team-sched th-sched">
                {games.map(g => {
                  const home = g.home_abbrev === abbrev
                  const opp = home ? g.away_abbrev : g.home_abbrev
                  const oppName = teamShortName(sport, opp, home ? g.away_team : g.home_team)
                  const su = teamSuResult(g, abbrev)
                  const ats = teamAtsResult(g, abbrev)
                  const ou = ouResult(g)
                  const line = teamLine(g, abbrev)
                  const mine = home ? g.home_score : g.away_score
                  const theirs = home ? g.away_score : g.home_score
                  const total = g.total_current ?? null
                  return (
                    <li key={g.id}>
                      <Link href={gamePath(sport, g.slug)} className={`team-sched__row${g.status === 'post' ? ' is-final' : ''}`}>
                        <span className="team-sched__when">
                          {dayText(g.kickoff)}
                          {!dated && <span className="team-sched__wk">{weekLabel(g.season_type, g.week, sport)}</span>}
                        </span>
                        <span className="team-sched__opp">
                          <span className="team-sched__at">{home ? 'vs' : '@'}</span> {oppName}
                        </span>
                        <span className="team-sched__res">
                          {su ? (
                            <><b className={`team-res team-res--${su}`}>{su}</b> {mine}-{theirs}</>
                          ) : g.status === 'in' ? 'Live' : ''}
                        </span>
                        <span className="team-sched__cell team-sched__cell--line">
                          <span className="team-sched__key">Line</span>
                          {line !== null ? signedLine(line) : '—'}
                          {ats && <b className={`team-res team-res--${ats}`}>{ats}</b>}
                        </span>
                        <span className="team-sched__cell team-sched__cell--total">
                          <span className="team-sched__key">Total</span>
                          {total !== null ? total : '—'}
                          {ou && <b className={`team-res team-res--ou-${ou}`}>{ou === 'over' ? 'O' : ou === 'under' ? 'U' : 'P'}</b>}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ol>
            </section>
          </div>

          <aside className="th-side" aria-label="Injuries and the Wire">
            <section className="th-card" aria-labelledby="th-inj">
              <header className="th-hd">
                <h2 id="th-inj">Injuries</h2>
                <small>Status · body part</small>
              </header>
              {!live || !(['nfl', 'nba', 'cfb'] as string[]).includes(sport) ? (
                <p className="th-empty">No injury feed for {league}.</p>
              ) : myInjuries.length === 0 ? (
                <p className="th-empty">Nobody listed out, doubtful or questionable.</p>
              ) : (
                <ul className="th-inj">
                  {myInjuries.map(i => (
                    <li key={`${i.name}-${i.status}`}>
                      <span className={`th-inj__st th-inj__st--${INJ_CLASS[i.status]}`} title={i.status}>{INJ_SHORT[i.status]}</span>
                      <span className="th-inj__name"><b>{i.name}</b>{i.pos ? <span className="th-dim"> {i.pos}</span> : null}</span>
                      {i.detail && <span className="th-inj__part">{i.detail}</span>}
                    </li>
                  ))}
                </ul>
              )}
              {myInjuries.length > 0 && <p className="th-src">Injury designations via ESPN.</p>}
            </section>

            <section className="th-card" aria-labelledby="th-wire">
              <header className="th-hd">
                <h2 id="th-wire">On the Wire</h2>
                <Link href="/news">All news &rarr;</Link>
              </header>
              {teamWire.length === 0 ? (
                <p className="th-empty">Nothing on the Wire for {t.shortName} right now.</p>
              ) : (
                <ul className="th-wire">
                  {teamWire.map(w => (
                    <li key={w.id}>
                      <Link href={w.href} className="th-wire__item">
                        <span className="th-wire__kick">{w.kind === 'injury' ? 'Injury' : 'Line move'} · {w.kicker}</span>
                        <b>{w.headline}</b>
                        {w.chips.length > 0 && (
                          <span className="th-wire__chips">
                            {w.chips.map(c => <span key={c.label} className={`th-chip th-chip--${c.tone}`}>{c.label}</span>)}
                          </span>
                        )}
                        <small className="th-dim">{w.when}</small>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>

        <p className="desk-attrib th-attrib">
          Results are graded against the closing line, the last price posted before {dated ? 'tip-off' : 'kickoff'}.
          Odds shown for reference only. If gambling stops being fun, call 1-800-GAMBLER.
        </p>
      </div>
    </main>
  )
}

function TeamMark({ sport, abbrev }: { sport: string; abbrev: string }) {
  const src = teamLogoUrl(sport, abbrev)
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt={abbrev} width={40} height={40} loading="lazy" decoding="async" className="th-mark" />
    : <span className="th-mark th-mark--txt">{abbrev}</span>
}
