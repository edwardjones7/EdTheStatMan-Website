// Default cover photos for blog posts. A post's own cover_image always wins;
// otherwise we match keywords in the title, then fall back to a per-tag pool
// spread deterministically by slug so the same post always shows the same photo.
//
// Sources (originals: /images/sports/* pre-July-2026 are Unsplash/CC0 rawpixel;
// the rest are Wikimedia Commons, resized/compressed):
//   nfl-qb.jpg          CC BY-SA 2.0  All-Pro Reels          commons.wikimedia.org/wiki/File:Taylor_Heinicke_throwing_(51398865322).jpg
//   nfl-stadium.jpg     CC BY-SA 4.0  MisawaSakura           commons.wikimedia.org/wiki/File:Lambeau_Field_at_night.jpg
//   nfl-redzone.jpg     CC BY-SA 2.0  All-Pro Reels          commons.wikimedia.org/wiki/File:WFT_vs._Buccaneers_(51684900492).jpg
//   nfl-defense.jpg     CC BY 2.0     Maryland GovPics       commons.wikimedia.org/wiki/File:NFL_2019_playoffs_Ravens_Vs_Titans.jpg
//   nba-dunk.jpg        Public domain U.S. Navy              commons.wikimedia.org/wiki/File:US_Navy_111110-N-DR144-711_Michigan_State_University_basketball_player_Adreian_Payne_dunks_during_a_practice_in_the_basketball_arena_on_the_flight.jpg
//   nba-arena.jpg       CC BY-SA 2.0  Tony B.                commons.wikimedia.org/wiki/File:Bulls_Pacers_2011_playoffs_game_1_jump_ball.jpg
//   nba-shot.jpg        CC BY 2.0     Dennis Yang            commons.wikimedia.org/wiki/File:File-2007_NBA_All_Star_Game.jpg
//   cfb-action.jpg      CC BY-SA 2.0  Ken Lund               commons.wikimedia.org/wiki/File:Jake_Rudock,_Michigan_Quarterback,_BYU_Cougars_vs._Michigan_Wolverines,_Michigan_Stadium,_University_of_Michigan,_Ann_Arbor,_Michigan_(21559571909).jpg
//   cfb-stadium.jpg     CC BY-SA 2.0  Ken Lund               commons.wikimedia.org/wiki/File:261st_Consecutive_Game_Over_100,000,_Michigan_Stadium,_University_of_Michigan,_Ann_Arbor,_Michigan_(21559655959).jpg
//   cbb-arena.jpg       Public domain Bill Evans, USAF       commons.wikimedia.org/wiki/File:Eric_Musselman_on_sideline_during_Nevada_at_Air_Force_basketball_game,_March_7,_2019.jpg
//   cbb-madness.jpg     Public domain Batistaya              commons.wikimedia.org/wiki/File:Basketball_court_0308.JPG
//   strategy-charts.jpg CC BY 2.0     nappa                  commons.wikimedia.org/wiki/File:Electronic_stock_board_in_Yaesu,_Tokyo_2007.jpg
//   strategy-odds.jpg   CC BY-SA 2.0  Baishampayan Ghose     commons.wikimedia.org/wiki/File:Las_Vegas_sportsbook.jpg
//   money-bankroll.jpg  CC BY 2.0     Andrew Magill          commons.wikimedia.org/wiki/File:Money_-_Flickr_-_AMagill.jpg
//   betting-slip.jpg    CC BY 2.0     Images Money           commons.wikimedia.org/wiki/File:Poker_Chips_with_houses.jpg
//   education-stats.jpg CC BY 2.0     Kalsau                 commons.wikimedia.org/wiki/File:DesignEthnographyStudioLifeAnalysis5.jpg
//   general-stadium.jpg CC BY 4.0     Krzysztof Popławski    commons.wikimedia.org/wiki/File:Mecz_piłkarski_Wisła_Kraków_-_Zagłębie_Sosnwoiec,_28_października_2022,_Pożegnanie_Stadionu_Ludowego,_KP.jpg
//   general-scoreboard.jpg CC BY-SA 4.0 Kenneth C. Zirkel    commons.wikimedia.org/wiki/File:Columbia_scoreboard_at_Wien_Stadium.jpg

const IMG = (name: string) => `/images/sports/${name}.jpg`

interface ImageRule {
  pattern: RegExp
  image: string
  /** Restrict the rule to these tags; omit for any tag. */
  tags?: string[]
}

// Ordered: most specific first. Word boundaries avoid false hits; sport-ambiguous
// words (playoff, arena…) are tag-restricted so e.g. an NBA playoff post never
// gets a football image.
const KEYWORD_RULES: ImageRule[] = [
  { pattern: /march madness|bracket|tourney|tournament|final four/i, image: IMG('cbb-madness'), tags: ['College Basketball', 'General'] },
  { pattern: /\bbankroll\b|\bunits?\b|money management|\bbudget\b|\bprofit\b/i, image: IMG('money-bankroll') },
  { pattern: /\bparlays?\b|\bteasers?\b|bet slip|same[- ]game|\bprops?\b/i, image: IMG('betting-slip') },
  { pattern: /\bodds\b|\bspreads?\b|moneyline|\bjuice\b|\bvig\b|\bline movement\b|sportsbook/i, image: IMG('strategy-odds') },
  { pattern: /\bmodel\b|\bdata\b|\bstats?\b|analytics|\bnumbers\b|\btrends?\b/i, image: IMG('strategy-charts'), tags: ['Strategy', 'Education', 'General'] },
  { pattern: /\bguide\b|\b101\b|\bbasics\b|beginner|how to|playbook/i, image: IMG('education-stats'), tags: ['Education', 'General'] },
  { pattern: /quarterback|\bqbs?\b|passing|passer/i, image: IMG('nfl-qb'), tags: ['NFL'] },
  { pattern: /touchdown|red zone|scoring|receiver/i, image: IMG('nfl-redzone'), tags: ['NFL'] },
  { pattern: /defense|\bsacks?\b|tackle|linebacker/i, image: IMG('nfl-defense'), tags: ['NFL'] },
  { pattern: /playoff|super bowl|primetime|stadium|lambeau/i, image: IMG('nfl-stadium'), tags: ['NFL'] },
  { pattern: /\bdunks?\b|\bslam\b/i, image: IMG('nba-dunk'), tags: ['NBA'] },
  { pattern: /\bthrees?\b|shoot|scorer|free throw|all[- ]star/i, image: IMG('nba-shot'), tags: ['NBA'] },
  { pattern: /playoff|finals|arena|tip[- ]?off/i, image: IMG('nba-arena'), tags: ['NBA'] },
  { pattern: /saturday|rivalry|\bbowl\b|crowd|big house|stadium/i, image: IMG('cfb-stadium'), tags: ['College Football'] },
  { pattern: /upset|underdog|scoreboard/i, image: IMG('general-scoreboard') },
]

// Fallback pools per tag — entry picked by a stable hash of the slug/title.
const TAG_POOL: Record<string, string[]> = {
  'NFL': [IMG('nfl'), IMG('nfl-qb'), IMG('nfl-redzone'), IMG('nfl-defense'), IMG('nfl-stadium')],
  'NBA': [IMG('nba'), IMG('nba-dunk'), IMG('nba-arena'), IMG('nba-shot')],
  'College Football': [IMG('cfb'), IMG('cfb-action'), IMG('cfb-stadium')],
  'College Basketball': [IMG('cbb'), IMG('cbb-arena'), IMG('cbb-madness')],
  'Education': [IMG('education'), IMG('education-stats')],
  'Strategy': [IMG('strategy'), IMG('strategy-charts'), IMG('strategy-odds')],
  'General': [IMG('general'), IMG('general-stadium'), IMG('general-scoreboard')],
}

// FNV-1a plus the sum of numeric tokens: deterministic across renders, and the
// numeric part keeps date-series posts ("...april-29th-2026") from clumping on
// the same pool image — pure FNV collides mod small pool sizes for near-identical
// sibling slugs.
function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  const nums = (s.match(/\d+/g) ?? []).reduce((acc, n) => acc + parseInt(n, 10), 0)
  return ((h >>> 0) + nums) >>> 0
}

export function coverForPost(
  coverImage: string | null | undefined,
  tag: string,
  title?: string,
  slug?: string,
): string {
  if (coverImage) return coverImage

  if (title) {
    for (const rule of KEYWORD_RULES) {
      if (rule.tags && !rule.tags.includes(tag)) continue
      if (rule.pattern.test(title)) return rule.image
    }
  }

  const pool = TAG_POOL[tag] ?? TAG_POOL['General']
  return pool[hashString(slug || title || tag) % pool.length]
}
