// The desk agent's tool registry.
//
// SECURITY MODEL, stated plainly: a tool the caller is not entitled to is never
// handed to the model. The gate is this registry plus buildToolset() below, and
// it runs on the server before the request leaves us.
//
// A prompt instruction not to reveal Institutional data is NOT a gate. Prompts
// are advisory; a tool that isn't in the toolset cannot be called at all.
//
// Defence in depth: every tool that reads gated rows ALSO filters by the
// caller's tier inside its own query, so a tool wired into the wrong tier by
// mistake still cannot return rows above that tier.

import { tool } from 'ai'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { atLeastTier, normalizeTier, TIER_RANK, type Tier } from '@/lib/access'
import { rowMinTier } from '@/lib/gate'
import { currentWeekOf, weekLabel, spreadLabel } from '@/lib/nfl'
import type { NflGame } from '@/lib/nfl'

/** Rows a caller may read, filtered in the query layer as well as the registry. */
function visibleRows<T extends Record<string, any>>(
  rows: T[],
  userTier: Tier | null,
  paidDefault: Tier
): T[] {
  return rows.filter(r => atLeastTier(userTier, rowMinTier(r as any, paidDefault)))
}

/** The tables a `kind` argument selects. Defined once; four tools use it. */
function tablesFor(kind: 'systems' | 'trends' | 'both'): string[] {
  if (kind === 'both') return ['betting_systems', 'betting_trends']
  return [kind === 'systems' ? 'betting_systems' : 'betting_trends']
}

/**
 * The columns export_vault is allowed to emit, listed explicitly.
 *
 * Not derived from the row. The queries behind it are select('*'), so deriving
 * columns from the data would silently export every column these tables gain
 * later -- including internal flags and anything not meant to be sold. Adding a
 * column to the export must be a deliberate edit here.
 */
const EXPORT_COLUMNS = [
  'sport', 'team', 'description', 'line', 'type', 'season', 'date',
  'w', 'l', 't', 'pct', 'units',
] as const

/** Rows per export call. Enough to be a real export, small enough to stream. */
const EXPORT_ROW_CAP = 2000

/** RFC 4180 escaping: quote when the value contains a comma, quote or newline. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export interface ToolContext {
  tier: Tier | null
  isAdmin: boolean
}

/** Each entry names the rung required to even see the tool. */
interface ToolSpec {
  minTier: Tier
  /**
   * Safe to hand to a caller who is not signed in at all.
   *
   * `minTier: 'retail'` is NOT the same thing -- retail means "has an account
   * and is therefore a known person with a per-user quota". This flag is a
   * separate, deliberately short whitelist: a tool is anon-safe only if it
   * reads nothing a stranger could not already see by scrolling the public
   * site. Adding one here widens what an unauthenticated caller can pull out
   * of the database, so do it on purpose or not at all.
   */
  anon?: true
  build: (ctx: ToolContext) => any
}

const REGISTRY: Record<string, ToolSpec> = {
  // ---------------------------------------------------------------- retail
  explain_membership: {
    minTier: 'retail',
    // Anon-safe: this is the price list. It is on /win in larger type.
    anon: true,
    build: () => tool({
      description:
        'Explain what each membership rung includes and what it costs. Use this whenever the ' +
        'user asks what they get, what something costs, or whether an upgrade is worth it.',
      inputSchema: z.object({
        rung: z.enum(['retail', 'portfolio', 'desk', 'private', 'institutional'])
          .optional()
          .describe('A specific rung to describe. Omit to describe the whole ladder.'),
      }),
      execute: async ({ rung }) => {
        const { OFFER_PLANS, OFFER_FREE_FEATURES } = await import('@/lib/offer')
        const all = [
          {
            key: 'retail',
            name: 'Vault - Retail Intelligence',
            monthly: 'Free',
            season: 'Free',
            includes: OFFER_FREE_FEATURES.filter(f => f.included).map(f => f.text),
          },
          ...OFFER_PLANS.map(p => ({
            key: p.key,
            name: p.name,
            monthly: p.month.price + (p.month.mode === 'subscription' ? '/mo' : ' one-time'),
            season: p.season.price + ' season pass',
            includes: p.features,
          })),
        ]
        return rung ? all.filter(r => r.key === rung) : all
      },
    }),
  },

  performance_summary: {
    minTier: 'retail',
    // Anon-safe: filtered to show_on_results = true, which is by definition the
    // record we publish. Same rows the results page renders to the world.
    anon: true,
    build: () => tool({
      description:
        'The published win/loss record for graded picks. This is the public transparency ' +
        'record and contains no locked information.',
      inputSchema: z.object({
        sport: z.string().optional().describe('Filter to one sport, e.g. "nfl".'),
      }),
      execute: async ({ sport }) => {
        const admin = createAdminClient() as any
        let q = admin.from('todays_bets').select('sport, result, date').eq('show_on_results', true)
        if (sport) q = q.eq('sport', sport)
        const { data } = await q
        const rows = (data ?? []) as any[]
        const tally = { win: 0, loss: 0, push: 0, pending: 0 }
        for (const r of rows) {
          const k = String(r.result ?? 'pending').toLowerCase()
          if (k in tally) (tally as any)[k]++
        }
        const decided = tally.win + tally.loss
        return {
          ...tally,
          graded: rows.length,
          winPct: decided ? Number(((tally.win / decided) * 100).toFixed(1)) : null,
          note: 'Break-even against standard -110 juice is 52.4%.',
        }
      },
    }),
  },

  // ------------------------------------------------------------- portfolio
  current_picks: {
    minTier: 'portfolio',
    build: (ctx) => tool({
      description:
        'The current slate of picks the user has access to, with the play, the line and the ' +
        'unit sizing. Use for "what are today\'s picks" or to explain a specific play.',
      inputSchema: z.object({
        sport: z.string().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async ({ sport, limit }) => {
        const admin = createAdminClient() as any
        let q = admin.from('todays_bets').select('*').eq('is_active', true)
          .order('created_at', { ascending: false })
        if (sport) q = q.eq('sport', sport)
        const { data } = await q
        return visibleRows((data ?? []) as any[], ctx.tier, 'portfolio')
          .slice(0, limit ?? 20)
          .map(b => ({
            date: b.date, sport: b.sport, bet: b.bet, line: b.line,
            risk: b.risk, result: b.result, note: b.note,
          }))
      },
    }),
  },

  pick_history: {
    minTier: 'portfolio',
    build: (ctx) => tool({
      description:
        'The graded history of past picks: what was played, at what number, and how it ' +
        'settled. Use for "how did we do last week", "what is the record on NBA totals", ' +
        'or to look up a specific past play. Distinct from performance_summary, which ' +
        'returns only the public top-line record.',
      inputSchema: z.object({
        sport: z.string().optional(),
        result: z.enum(['win', 'loss', 'push', 'pending']).optional(),
        since: z.string().optional().describe('Earliest date to include, as stored, e.g. "2026-09-01".'),
        limit: z.number().int().min(1).max(100).default(30),
      }),
      execute: async ({ sport, result, since, limit }) => {
        const admin = createAdminClient() as any
        let q = admin.from('todays_bets').select('*').order('date', { ascending: false })
        if (sport) q = q.eq('sport', sport)
        if (result) q = q.eq('result', result)
        const { data } = await q

        const rows = visibleRows((data ?? []) as any[], ctx.tier, 'portfolio')
          .filter(b => (since ? String(b.date ?? '') >= since : true))

        const tally = { win: 0, loss: 0, push: 0, pending: 0 }
        for (const b of rows) {
          const k = String(b.result ?? 'pending').toLowerCase()
          if (k in tally) (tally as any)[k]++
        }
        const decided = tally.win + tally.loss

        return {
          matched: rows.length,
          record: `${tally.win}-${tally.loss}${tally.push ? `-${tally.push}` : ''}`,
          winPct: decided ? Number(((tally.win / decided) * 100).toFixed(1)) : null,
          pending: tally.pending,
          note: 'Break-even against standard -110 juice is 52.4%.',
          picks: rows.slice(0, limit).map(b => ({
            date: b.date, sport: b.sport, bet: b.bet, opponent: b.opponent,
            line: b.line, risk: b.risk, win: b.win, result: b.result, note: b.note,
          })),
        }
      },
    }),
  },

  // ------------------------------------------------------------------ desk
  week_schedule: {
    minTier: 'desk',
    build: () => tool({
      description:
        'The games on a given week of the schedule, with kickoff, current spread, total and ' +
        'how the line has moved since it opened. Omit the week to get the current one.',
      inputSchema: z.object({
        sport: z.string().default('nfl'),
        week: z.number().int().min(1).max(25).optional(),
        seasonType: z.number().int().optional().describe('2 = regular season, 3 = postseason'),
      }),
      execute: async ({ sport, week, seasonType }) => {
        const admin = createAdminClient() as any
        const { data } = await admin.from('nfl_games').select('*').eq('is_published', true)
          .order('kickoff', { ascending: true })
        const games = ((data ?? []) as NflGame[]).filter(g => (g.sport ?? 'nfl') === sport)
        const target = week
          ? { season_type: seasonType ?? 2, week }
          : currentWeekOf(games, new Date())
        if (!target) return { games: [], note: 'No schedule loaded for this sport yet.' }
        return {
          week: weekLabel(target.season_type, target.week),
          games: games
            .filter(g => g.season_type === target.season_type && g.week === target.week)
            .map(g => ({
              matchup: `${g.away_abbrev} @ ${g.home_abbrev}`,
              kickoff: g.kickoff,
              status: g.status,
              spread: spreadLabel(g.spread_current, g.home_abbrev, g.away_abbrev),
              spreadOpen: spreadLabel(g.spread_open, g.home_abbrev, g.away_abbrev),
              total: g.total_current,
              totalOpen: g.total_open,
              broadcast: g.broadcast,
              score: g.status === 'post' ? `${g.away_score}-${g.home_score}` : null,
              slug: g.slug,
            })),
        }
      },
    }),
  },

  game_research: {
    minTier: 'desk',
    build: (ctx) => tool({
      description:
        'The curated systems and trends attached to one specific matchup, with each one\'s ' +
        'record. This is the Research Desk\'s core value: what applies to THIS game.',
      inputSchema: z.object({
        slug: z.string().describe('The game slug, e.g. "2026-wk1-ne-at-sea".'),
      }),
      execute: async ({ slug }) => {
        const admin = createAdminClient() as any
        const { data: game } = await admin.from('nfl_games').select('*').eq('slug', slug).maybeSingle()
        if (!game) return { error: 'No game with that slug.' }

        const [sysLinks, trendLinks] = await Promise.all([
          admin.from('nfl_game_systems').select('system_id').eq('game_id', game.id),
          admin.from('nfl_game_trends').select('trend_id').eq('game_id', game.id),
        ])
        const sysIds = (sysLinks.data ?? []).map((r: any) => r.system_id)
        const trendIds = (trendLinks.data ?? []).map((r: any) => r.trend_id)

        const [systems, trends] = await Promise.all([
          sysIds.length ? admin.from('betting_systems').select('*').in('id', sysIds) : { data: [] },
          trendIds.length ? admin.from('betting_trends').select('*').in('id', trendIds) : { data: [] },
        ])

        // The Desk rule: curated Vault rows are readable IN THE CONTEXT of a
        // matchup for Desk members, but Institutional rows stay shut everywhere.
        const deskVisible = (rows: any[]) => rows.filter(r => {
          const required = rowMinTier(r, 'private')
          if (required === 'institutional') return atLeastTier(ctx.tier, 'institutional')
          return atLeastTier(ctx.tier, 'desk')
        })

        const shape = (r: any) => ({
          description: r.description, line: r.line, type: r.type,
          record: `${r.w ?? 0}-${r.l ?? 0}${r.t ? `-${r.t}` : ''}`,
          winPct: r.pct, units: r.units, team: r.team, season: r.season,
        })

        return {
          matchup: `${game.away_abbrev} @ ${game.home_abbrev}`,
          kickoff: game.kickoff,
          spread: spreadLabel(game.spread_current, game.home_abbrev, game.away_abbrev),
          total: game.total_current,
          brief: game.brief || null,
          systems: deskVisible((systems as any).data ?? []).map(shape),
          trends: deskVisible((trends as any).data ?? []).map(shape),
        }
      },
    }),
  },

  desk_note: {
    minTier: 'desk',
    build: (ctx) => tool({
      description:
        "The weekly desk note: the editorial read on a week's slate and the reasoning " +
        'behind it. Omit the week to get the most recent published note. Quote it as the ' +
        "desk's view, not as your own analysis.",
      inputSchema: z.object({
        sport: z.string().default('nfl'),
        season: z.number().int().optional(),
        week: z.number().int().min(1).max(25).optional(),
        seasonType: z.number().int().optional().describe('2 = regular season, 3 = postseason'),
      }),
      execute: async ({ sport, season, week, seasonType }) => {
        const admin = createAdminClient() as any
        let q = admin.from('desk_notes').select('*')
          .eq('sport', sport)
          .eq('is_published', true)
          .order('season', { ascending: false })
          .order('season_type', { ascending: false })
          .order('week', { ascending: false })
        if (season) q = q.eq('season', season)
        if (week) q = q.eq('week', week)
        if (seasonType) q = q.eq('season_type', seasonType)

        const { data, error } = await q
        // The table arrives with tier_ladder_06, which is applied by hand. Say
        // so plainly rather than surfacing a Postgres error to the model.
        if (error) return { note: null, reason: 'No desk notes are available yet.' }

        // desk_notes carries its own min_tier (default 'desk'), so a note can be
        // pitched above the Desk rung without moving the schedule with it.
        const readable = ((data ?? []) as any[])
          .filter(n => atLeastTier(ctx.tier, normalizeTier(n.min_tier)))

        const note = readable[0]
        if (!note) {
          return {
            note: null,
            reason: (data ?? []).length
              ? 'A note exists for that week but is above this membership.'
              : 'No published desk note for that week yet.',
          }
        }

        return {
          title: note.title,
          sport: note.sport,
          week: weekLabel(note.season_type, note.week),
          season: note.season,
          body: note.body_html,
        }
      },
    }),
  },

  // --------------------------------------------------------------- private
  game_writeup: {
    minTier: 'private',
    build: (ctx) => tool({
      description:
        'The full written breakdown for one matchup: the long-form analysis behind the ' +
        'curated systems. Use only when the user asks for the deep read on a specific game.',
      inputSchema: z.object({
        slug: z.string().describe('The game slug, e.g. "2026-wk1-ne-at-sea".'),
      }),
      execute: async ({ slug }) => {
        // Belt and braces. This is the single path by which writeup_html can
        // leave the server, so it re-checks the rung rather than trusting that
        // the registry wired it correctly.
        if (!(ctx.isAdmin || atLeastTier(ctx.tier, 'private'))) {
          return { error: 'Not available on this membership.' }
        }
        const admin = createAdminClient() as any
        const { data: game } = await admin.from('nfl_games').select('*')
          .eq('slug', slug).maybeSingle()
        if (!game) return { error: 'No game with that slug.' }
        if (!game.is_published) return { error: 'That game is not published yet.' }
        if (!game.writeup_html) {
          return { matchup: `${game.away_abbrev} @ ${game.home_abbrev}`, writeup: null,
                   reason: 'No write-up has been published for this game.' }
        }
        return {
          matchup: `${game.away_abbrev} @ ${game.home_abbrev}`,
          kickoff: game.kickoff,
          week: weekLabel(game.season_type, game.week),
          writeup: game.writeup_html,
        }
      },
    }),
  },

  search_vault: {
    minTier: 'private',
    build: (ctx) => tool({
      description:
        'Search the full Vault library of systems and team trends. Filter by sport, team, ' +
        'bet type or minimum sample size, and sort by win rate. Use this for open-ended ' +
        'questions like "which NFL road underdog systems have the best record".',
      inputSchema: z.object({
        kind: z.enum(['systems', 'trends', 'both']).default('both'),
        sport: z.string().optional(),
        team: z.string().optional().describe('Team name or abbreviation to filter on.'),
        line: z.string().optional().describe('Bet type, e.g. "ATS", "O/U", "ML".'),
        minGames: z.number().int().min(0).optional().describe('Minimum W+L+T sample size.'),
        minWinPct: z.number().min(0).max(1).optional().describe('Minimum win rate, 0-1.'),
        limit: z.number().int().min(1).max(50).default(15),
      }),
      execute: async ({ kind, sport, team, line, minGames, minWinPct, limit }) => {
        const admin = createAdminClient() as any
        const out: any[] = []
        for (const table of tablesFor(kind)) {
          let q = admin.from(table).select('*').eq('is_active', true)
          if (sport) q = q.eq('sport', sport)
          if (line) q = q.eq('line', line)
          if (team) q = q.ilike('team', `%${team}%`)
          const { data } = await q
          for (const r of visibleRows((data ?? []) as any[], ctx.tier, 'private')) {
            const games = (r.w ?? 0) + (r.l ?? 0) + (r.t ?? 0)
            if (minGames && games < minGames) continue
            if (minWinPct && (r.pct ?? 0) < minWinPct) continue
            out.push({
              kind: table === 'betting_systems' ? 'system' : 'trend',
              sport: r.sport, team: r.team, description: r.description,
              line: r.line, type: r.type, season: r.season,
              record: `${r.w ?? 0}-${r.l ?? 0}${r.t ? `-${r.t}` : ''}`,
              games, winPct: r.pct, units: r.units,
            })
          }
        }
        out.sort((a, b) => (b.winPct ?? 0) - (a.winPct ?? 0) || b.games - a.games)
        return { count: out.length, results: out.slice(0, limit) }
      },
    }),
  },

  // --------------------------------------------------------- institutional
  vault_aggregate: {
    minTier: 'institutional',
    build: (ctx) => tool({
      description:
        'Aggregate across the whole Vault: group systems and trends by a dimension and return ' +
        'summed records and win rates. Use for portfolio-level questions such as "how do ATS ' +
        'systems compare to totals across the NFL".',
      inputSchema: z.object({
        groupBy: z.enum(['sport', 'line', 'type', 'team', 'season']),
        kind: z.enum(['systems', 'trends', 'both']).default('both'),
        minGames: z.number().int().min(0).default(0),
      }),
      execute: async ({ groupBy, kind, minGames }) => {
        const admin = createAdminClient() as any
        const buckets = new Map<string, { w: number; l: number; t: number; units: number; rows: number }>()
        for (const table of tablesFor(kind)) {
          const { data } = await admin.from(table).select('*').eq('is_active', true)
          for (const r of visibleRows((data ?? []) as any[], ctx.tier, 'private')) {
            const games = (r.w ?? 0) + (r.l ?? 0) + (r.t ?? 0)
            if (games < minGames) continue
            const key = String(r[groupBy] ?? 'unknown')
            const b = buckets.get(key) ?? { w: 0, l: 0, t: 0, units: 0, rows: 0 }
            b.w += r.w ?? 0; b.l += r.l ?? 0; b.t += r.t ?? 0
            b.units += Number(r.units ?? 0); b.rows++
            buckets.set(key, b)
          }
        }
        return [...buckets.entries()]
          .map(([key, b]) => ({
            [groupBy]: key, rows: b.rows, w: b.w, l: b.l, t: b.t,
            units: Number(b.units.toFixed(2)),
            winPct: b.w + b.l ? Number((b.w / (b.w + b.l)).toFixed(4)) : null,
          }))
          .sort((a, b) => (b.winPct ?? 0) - (a.winPct ?? 0))
      },
    }),
  },

  export_vault: {
    minTier: 'institutional',
    build: (ctx) => tool({
      description:
        'Export raw Vault rows as CSV: every field of every system or trend matching the ' +
        'filters, not a summary. Use when the user asks to export, download, or get the raw ' +
        'data. Tell them how many rows came back and whether it was truncated.',
      inputSchema: z.object({
        kind: z.enum(['systems', 'trends', 'both']).default('both'),
        sport: z.string().optional(),
        team: z.string().optional(),
        line: z.string().optional().describe('Bet type, e.g. "ATS", "O/U", "ML".'),
        minGames: z.number().int().min(0).optional(),
        minWinPct: z.number().min(0).max(1).optional(),
      }),
      execute: async ({ kind, sport, team, line, minGames, minWinPct }) => {
        const admin = createAdminClient() as any
        const rows: any[] = []
        for (const table of tablesFor(kind)) {
          let q = admin.from(table).select('*').eq('is_active', true)
          if (sport) q = q.eq('sport', sport)
          if (line) q = q.eq('line', line)
          if (team) q = q.ilike('team', `%${team}%`)
          const { data } = await q
          // Rows are still filtered at 'private'. Institutional buys the export
          // capability, not additional rows -- see lib/access.ts and
          // tier_ladder_02. Same data, new verb.
          for (const r of visibleRows((data ?? []) as any[], ctx.tier, 'private')) {
            const games = (r.w ?? 0) + (r.l ?? 0) + (r.t ?? 0)
            if (minGames && games < minGames) continue
            if (minWinPct && (r.pct ?? 0) < minWinPct) continue
            rows.push({ kind: table === 'betting_systems' ? 'system' : 'trend', games, row: r })
          }
        }

        rows.sort((a, b) => b.games - a.games)
        const truncated = rows.length > EXPORT_ROW_CAP
        const page = rows.slice(0, EXPORT_ROW_CAP)

        // Built column by column from an explicit list. The query above is
        // select('*'), so a spread here would ship every column the table gains
        // in future -- including any that is not meant to be sold.
        const header = ['kind', ...EXPORT_COLUMNS, 'games'].join(',')
        const body = page.map(({ kind: k, games, row }) =>
          [csvCell(k), ...EXPORT_COLUMNS.map(c => csvCell(row[c])), csvCell(games)].join(',')
        )

        return {
          count: page.length,
          totalMatched: rows.length,
          truncated,
          note: truncated
            ? `Capped at ${EXPORT_ROW_CAP} rows. Narrow the filters to export the rest.`
            : null,
          filename: `vault-${kind}-${new Date().toISOString().slice(0, 10)}.csv`,
          csv: [header, ...body].join('\n'),
        }
      },
    }),
  },

  query_vault: {
    minTier: 'institutional',
    build: (ctx) => tool({
      description:
        'Query builder over the whole Vault. Filter on any combination of sport, team, bet ' +
        'type, season, sample size, win rate and units, then optionally group and sort. Use ' +
        'this for precise multi-condition questions that search_vault cannot express, such ' +
        'as "NFL road dog ATS systems with 80+ games and a win rate over 58%, grouped by season".',
      inputSchema: z.object({
        kind: z.enum(['systems', 'trends', 'both']).default('both'),
        sport: z.string().optional(),
        team: z.string().optional(),
        line: z.string().optional(),
        type: z.string().optional(),
        season: z.string().optional(),
        contains: z.string().optional().describe('Substring to match within the rule description.'),
        minGames: z.number().int().min(0).optional(),
        maxGames: z.number().int().min(0).optional(),
        minWinPct: z.number().min(0).max(1).optional(),
        maxWinPct: z.number().min(0).max(1).optional(),
        minUnits: z.number().optional(),
        groupBy: z.enum(['sport', 'line', 'type', 'team', 'season']).optional()
          .describe('Omit to get matching rows; set to get summed buckets.'),
        minRowsPerGroup: z.number().int().min(1).default(1),
        sortBy: z.enum(['winPct', 'games', 'units']).default('winPct'),
        direction: z.enum(['asc', 'desc']).default('desc'),
        limit: z.number().int().min(1).max(100).default(25),
      }),
      execute: async (a) => {
        const admin = createAdminClient() as any
        const matched: any[] = []
        for (const table of tablesFor(a.kind)) {
          // Only whitelisted, typed filters reach the database. There is no
          // free-form SQL path here and there must never be one.
          let q = admin.from(table).select('*').eq('is_active', true)
          if (a.sport) q = q.eq('sport', a.sport)
          if (a.line) q = q.eq('line', a.line)
          if (a.type) q = q.eq('type', a.type)
          if (a.season) q = q.eq('season', a.season)
          if (a.team) q = q.ilike('team', `%${a.team}%`)
          if (a.contains) q = q.ilike('description', `%${a.contains}%`)
          const { data } = await q

          for (const r of visibleRows((data ?? []) as any[], ctx.tier, 'private')) {
            const games = (r.w ?? 0) + (r.l ?? 0) + (r.t ?? 0)
            const units = Number(r.units ?? 0)
            if (a.minGames !== undefined && games < a.minGames) continue
            if (a.maxGames !== undefined && games > a.maxGames) continue
            if (a.minWinPct !== undefined && (r.pct ?? 0) < a.minWinPct) continue
            if (a.maxWinPct !== undefined && (r.pct ?? 0) > a.maxWinPct) continue
            if (a.minUnits !== undefined && units < a.minUnits) continue
            matched.push({
              kind: table === 'betting_systems' ? 'system' : 'trend',
              sport: r.sport, team: r.team, description: r.description,
              line: r.line, type: r.type, season: r.season, date: r.date,
              w: r.w ?? 0, l: r.l ?? 0, t: r.t ?? 0,
              record: `${r.w ?? 0}-${r.l ?? 0}${r.t ? `-${r.t}` : ''}`,
              games, winPct: r.pct, units,
            })
          }
        }

        const dir = a.direction === 'asc' ? 1 : -1
        const pick = (x: any) =>
          a.sortBy === 'games' ? x.games : a.sortBy === 'units' ? x.units : (x.winPct ?? 0)

        if (!a.groupBy) {
          const sorted = matched.sort((x, y) => (pick(x) - pick(y)) * dir)
          return {
            matched: matched.length,
            returned: Math.min(sorted.length, a.limit),
            results: sorted.slice(0, a.limit),
          }
        }

        const buckets = new Map<string, { w: number; l: number; t: number; units: number; rows: number }>()
        for (const m of matched) {
          const key = String((m as any)[a.groupBy] ?? 'unknown')
          const b = buckets.get(key) ?? { w: 0, l: 0, t: 0, units: 0, rows: 0 }
          b.w += m.w; b.l += m.l; b.t += m.t; b.units += m.units; b.rows++
          buckets.set(key, b)
        }

        const groups = [...buckets.entries()]
          .filter(([, b]) => b.rows >= a.minRowsPerGroup)
          .map(([key, b]) => ({
            [a.groupBy!]: key,
            rows: b.rows,
            record: `${b.w}-${b.l}${b.t ? `-${b.t}` : ''}`,
            games: b.w + b.l + b.t,
            units: Number(b.units.toFixed(2)),
            winPct: b.w + b.l ? Number((b.w / (b.w + b.l)).toFixed(4)) : null,
          }))
          .sort((x, y) => (pick(x) - pick(y)) * dir)

        return { matchedRows: matched.length, groups: groups.slice(0, a.limit) }
      },
    }),
  },
}

/**
 * May this caller use this tool?
 *
 * `tier: null` means signed out, NOT "lowest rung" -- atLeastTier(null, ...) is
 * false for every rung, so a signed-out caller falls through to the anon
 * whitelist and gets nothing else. That is the whole gate for anonymous
 * traffic, and it is one line on purpose.
 */
function entitledTo(ctx: ToolContext, spec: ToolSpec): boolean {
  if (ctx.isAdmin) return true
  if (ctx.tier === null) return spec.anon === true
  return atLeastTier(ctx.tier, spec.minTier)
}

/**
 * The toolset for one caller. Tools above the caller's rung are omitted
 * entirely -- the model is never told they exist, so it cannot call them and
 * cannot be talked into calling them.
 */
export function buildToolset(ctx: ToolContext): Record<string, any> {
  const out: Record<string, any> = {}
  for (const [name, spec] of Object.entries(REGISTRY)) {
    if (entitledTo(ctx, spec)) out[name] = spec.build(ctx)
  }
  return out
}

/**
 * How many tool-calling turns this caller's questions are worth.
 *
 * This is the other half of "querying gets better as you go up", and the half
 * that is invisible: the toolset decides WHAT can be reached, the step budget
 * decides how much WORK the agent may do before it must answer. An
 * Institutional question -- query the Vault, group it, cross-check a season,
 * then export -- genuinely needs more turns than "what does this cost", and
 * capping them at the same number would make the top rung feel stupid rather
 * than expensive.
 *
 * Also the runaway-loop ceiling, which is why even the top rung has a number.
 */
export const STEPS_FOR: Record<Tier, number> = {
  retail: 4,
  portfolio: 6,
  desk: 8,
  private: 12,
  institutional: 16,
}

/** Signed-out callers have two tools; two steps is a call and an answer. */
export const ANON_STEPS = 3

/** The step budget for one caller, including the signed-out case. */
export function stepBudget(ctx: ToolContext): number {
  if (ctx.isAdmin) return STEPS_FOR.institutional
  if (ctx.tier === null) return ANON_STEPS
  return STEPS_FOR[ctx.tier] ?? STEPS_FOR.retail
}

/** The next rung up, for upsell copy. null when they are at the top. */
export function nextRung(tier: Tier | null): Tier | null {
  const rank = tier ? TIER_RANK[tier] : -1
  const order: Tier[] = ['retail', 'portfolio', 'desk', 'private', 'institutional']
  return order.find(t => TIER_RANK[t] > rank) ?? null
}

/** Which tools exist above this caller -- named for the upsell, never callable. */
export function lockedToolNames(ctx: ToolContext): string[] {
  return Object.entries(REGISTRY)
    .filter(([, spec]) => !entitledTo(ctx, spec))
    .map(([name]) => name)
}
