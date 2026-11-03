import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { toPublicGame, gamePath, weekLabel } from '@/lib/nfl'
import type { PublicNflGame } from '@/lib/nfl'
import { DESK_SPORTS, deskSportLabel, deskSeasonLabel, weeksFromDates } from '@/lib/desk'
import {
  teamSeasonSummary, teamAtsResult, teamSuResult, ouResult, teamLine, signedLine, recordText,
} from '@/lib/ats'
import type { TeamSeasonSummary } from '@/lib/ats'
import { abbrevFromParam, latestPublishedSeason, teamSeasonGames, teamShortName, teamPath } from '@/lib/desk-teams'
import { teamLogoUrl } from '@/lib/logos'
import '@/styles/seo-desk.css'

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

  const admin = createAdminClient()
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

export default async function DeskTeamPage({ params }: { params: { sport: string; abbrev: string } }) {
  const t = await loadTeam(params.sport, params.abbrev)
  if (!t) notFound()

  const { sport, abbrev, season, games, summary: s } = t
  const league = deskSportLabel(sport)
  const seasonLabel = deskSeasonLabel(sport, season)
  const logo = teamLogoUrl(sport, abbrev)
  const url = `${BASE}${teamPath(sport, abbrev)}`
  const dated = weeksFromDates(sport)

  const stats = [
    { label: 'Straight up', value: recordText(s.su.w, s.su.l, s.su.t), n: s.finals },
    { label: 'Against the spread', value: recordText(s.ats.w, s.ats.l, s.ats.p), n: s.ats.w + s.ats.l + s.ats.p },
    { label: 'Over / under', value: recordText(s.ou.o, s.ou.u, s.ou.p), n: s.ou.o + s.ou.u + s.ou.p },
  ]

  return (
    <main>
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

      <section className="section" style={{ paddingBottom: '48px' }}>
        <div className="container" style={{ maxWidth: '900px' }}>
          <Link href={`/desk/${sport}`} className="blog-post__back">&larr; Back to the {league} Desk</Link>

          <header className="team-head">
            <span className="team-head__tile" aria-hidden="true">
              {logo
                ? <img src={logo} alt="" width={64} height={64} decoding="async" className="team-head__logo" />
                : abbrev}
            </span>
            <div className="team-head__text">
              <span className="section-label" style={{ margin: 0 }}>{league} · {seasonLabel}</span>
              <h1 className="team-head__title">{t.fullName}</h1>
              <p className="team-head__sub">
                Schedule, closing lines and results against the spread for the {seasonLabel} season.
              </p>
            </div>
          </header>

          <div className="team-stats" role="list">
            {stats.map(st => (
              <div className="team-stats__cell" role="listitem" key={st.label}>
                <span className="team-stats__value">{st.n > 0 ? st.value : '—'}</span>
                <span className="team-stats__label">{st.label}</span>
              </div>
            ))}
          </div>
          {s.finals > 0 && s.ats.w + s.ats.l + s.ats.p < s.finals && (
            <p className="team-note">
              ATS and totals count only finals with a closing line on file.
            </p>
          )}

          <h2 className="team-section-title">{seasonLabel} schedule</h2>
          <ol className="team-sched">
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

          <p className="desk-attrib">
            Results are graded against the closing line, the last price posted before {dated ? 'tip-off' : 'kickoff'}.
            Odds shown for reference only. If gambling stops being fun, call 1-800-GAMBLER.
          </p>
        </div>
      </section>
    </main>
  )
}
