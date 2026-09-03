// What the visitor is currently looking at.
//
// The difference between a chatbot that happens to be on the page and an
// analyst who is ON the page is whether "what does this one mean?" works. The
// panel sends its pathname with every message; this turns that into a sentence
// the model can use, plus -- where the route carries one -- the identifier a
// tool needs to actually go and read the thing being pointed at.
//
// PURE, and deliberately import-free apart from the tier types, so both the
// client panel and the route handler can use it.
//
// UNTRUSTED INPUT. The path arrives in the request body from the browser and is
// therefore whatever the caller chose to send. It only ever reaches the model
// as prose, never a query -- except `gameSlug`, which the model may pass to
// game_research, where it is a parameterised .eq() against nfl_games and is
// entitlement-checked there like any other call. Nothing here grants access to
// anything: a signed-out visitor who posts "/desk/nfl/g/whatever" gets a
// sentence about the Research Desk and a toolset that cannot read it.

export interface PageContext {
  /** Route pathname as the browser sees it, e.g. "/desk/nfl/g/2026-wk1-ne-at-sea". */
  path: string
  /** One line naming the page, for the system prompt. */
  label: string
  /** What the visitor can see there, and what to do about it. */
  hint: string
  /** The NFL game slug, when the route is a matchup page. */
  gameSlug?: string
  /** The blog post slug, when the route is an article. */
  postSlug?: string
  /** The sport key, when the route is scoped to one. */
  sport?: string
}

/** Longest-prefix wins, so the static entries below never shadow a deeper route. */
const STATIC: Record<string, { label: string; hint: string }> = {
  '/': {
    label: 'the homepage',
    hint: 'They are looking at the overview: the hero, the current record, a sample of ' +
      'the picks and an explanation of the memberships. Treat questions as broad ' +
      '"what is this service" questions unless they say otherwise.',
  },
  '/win': {
    label: 'the membership page (/win)',
    hint: 'They are comparing rungs and prices right now. Answer with explain_membership ' +
      'and be straight about what each one does and does not include. This is the page ' +
      'where vagueness costs a sale.',
  },
  '/portfolio': {
    label: 'the Portfolio (the live picks board)',
    hint: 'They are looking at the current graded and ungraded picks. current_picks ' +
      'returns the same rows they can see.',
  },
  '/portfolio/performance': {
    label: 'the Portfolio performance page',
    hint: 'They are looking at results over time. Lead with performance_summary and ' +
      'pick_history rather than describing individual picks.',
  },
  '/vault': {
    label: 'the Vault overview',
    hint: 'The Vault is the systems and trends library. They are at the top level, so ' +
      'orient them before diving into individual rules.',
  },
  '/vault/systems': {
    label: 'the Vault systems library',
    hint: 'Betting systems, filtered by sport tabs. Questions about "this one" or "these" ' +
      'mean systems rows. Always quote the record and the sample size.',
  },
  '/vault/trends': {
    label: 'the Vault trends library',
    hint: 'Betting trends, filtered by sport tabs. Questions about "this one" or "these" ' +
      'mean trends rows. Always quote the record and the sample size.',
  },
  '/desk': {
    label: 'the Research Desk',
    hint: 'The weekly board of upcoming games. week_schedule covers what they can see; ' +
      'game_research covers any single matchup on it.',
  },
  '/blog': {
    label: 'the blog index',
    hint: 'Articles and write-ups. You have no tool that reads post bodies, so do not ' +
      'summarise a post you have not been given.',
  },
  '/account': {
    label: 'their account page',
    hint: 'They are looking at their own membership and billing. Answer membership ' +
      'questions from explain_membership, and send anything about a charge, a refund ' +
      'or a cancellation to the contact page rather than guessing at their billing state.',
  },
  '/contact': {
    label: 'the contact page',
    hint: 'They may be about to write in. If you can answer the question outright, do ' +
      'that and save them the wait.',
  },
  '/admin': {
    label: 'the admin dashboard',
    hint: 'This is Ed or a colleague working on the site itself, not a member browsing.',
  },
  '/login': { label: 'the sign-in page', hint: 'Keep it short; they are mid-task.' },
  '/signup': {
    label: 'the sign-up page',
    hint: 'They are deciding whether to create an account. Answer what they get for free ' +
      'and be specific about it.',
  },
}

/** Sport keys the Desk routes use, mapped to how a person says them. */
const SPORT_LABEL: Record<string, string> = {
  nfl: 'NFL',
  nflpre: 'NFL preseason',
  nba: 'NBA',
  wnba: 'WNBA',
  cfb: 'College Football',
  cfl: 'CFL',
  cbb: 'College Basketball',
}

/**
 * Describe a pathname. Never throws and never returns null: an unrecognised
 * route degrades to "somewhere on the site", which is still better than the
 * model inventing a page.
 */
export function describePage(rawPath: unknown): PageContext {
  const path = typeof rawPath === 'string' && rawPath.startsWith('/')
    ? rawPath.split('?')[0].split('#')[0].slice(0, 200)
    : '/'

  const segments = path.split('/').filter(Boolean)

  // --- Dynamic routes first, longest shape first. -------------------------
  // /desk/[sport]/g/[slug]
  if (segments[0] === 'desk' && segments[2] === 'g' && segments[3]) {
    const sport = segments[1]
    const label = SPORT_LABEL[sport] ?? sport.toUpperCase()
    return {
      path,
      sport,
      gameSlug: segments[3],
      label: `a ${label} matchup page on the Research Desk`,
      hint:
        `The game slug is "${segments[3]}". If they ask about "this game", "the game", ` +
        '"tonight" or a team without naming a matchup, call game_research with that slug ' +
        'before answering. Do not ask them which game they mean when they are standing on it.',
    }
  }

  // /desk/[sport]
  if (segments[0] === 'desk' && segments[1]) {
    const sport = segments[1]
    const label = SPORT_LABEL[sport] ?? sport.toUpperCase()
    return {
      path,
      sport,
      label: `the ${label} board on the Research Desk`,
      hint:
        `Scope answers to ${label} unless they ask about something else. week_schedule ` +
        'lists what is on this board; game_research opens any one of them.',
    }
  }

  // /blog/[slug]
  if (segments[0] === 'blog' && segments[1]) {
    return {
      path,
      postSlug: segments[1],
      label: 'a blog article',
      hint:
        `The article slug is "${segments[1]}". You cannot read the article body -- you ` +
        'have no tool for it. Answer the underlying question from data, and never ' +
        'summarise or quote a post you have not actually been given.',
    }
  }

  // --- Static routes, longest prefix wins. --------------------------------
  const match = Object.keys(STATIC)
    .filter(key => key === '/' ? path === '/' : path === key || path.startsWith(key + '/'))
    .sort((a, b) => b.length - a.length)[0]

  if (match) return { path, ...STATIC[match] }

  return {
    path,
    label: 'a page on the site',
    hint: 'Nothing specific is known about this page; answer the question on its own terms.',
  }
}

/** The paragraph that goes into the system prompt. */
export function pageContextPrompt(ctx: PageContext): string {
  return [
    '## Where they are',
    `They are on ${ctx.label} (${ctx.path}).`,
    ctx.hint,
    'Use this to resolve "this", "these" and "here" without asking them to repeat ' +
    'what is already on their screen. If their question is plainly about something ' +
    'else, ignore the page entirely.',
  ].join('\n')
}
