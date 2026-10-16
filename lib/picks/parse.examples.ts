/**
 * What the regex fallback must keep getting right. Not wired to a test runner
 * (the repo has none); check by hand with plain node, which strips types:
 *
 *   cp lib/picks/parse.ts lib/picks/parse.examples.ts <scratch>/ &&
 *   sed -i "s#from './parse'#from './parse.ts'#" <scratch>/parse.examples.ts &&
 *   node <scratch>/parse.examples.ts
 *
 * The AI parser is not covered here: it is non-deterministic and costs money
 * per call, and Ed's approval is the real check on it.
 */
import { parseWithRegex, type ParsedPick } from './parse'

type Expect = Partial<ParsedPick>

export const EXAMPLES: { text: string; expect: Expect[] }[] = [
  { text: 'Chiefs -3.5 -110', expect: [{ sport: 'NFL', bet: 'Chiefs -3.5', line: '-3.5', odds: -110, market: 'spread' }] },
  { text: 'Lakers ML +130', expect: [{ sport: 'NBA', bet: 'Lakers ML', odds: 130, market: 'moneyline' }] },
  { text: 'o44.5 Bills/Dolphins', expect: [{ sport: 'NFL', bet: 'Bills/Dolphins Over 44.5', line: '44.5', market: 'total' }] },
  { text: 'Mahomes o2.5 pass TD -130', expect: [{ bet: 'Mahomes Over 2.5 Pass TD', odds: -130, market: 'prop', isProp: true, playerName: 'Mahomes' }] },
  { text: 'Bears +7 (-115) vs Packers', expect: [{ sport: 'NFL', bet: 'Bears +7', odds: -115, opponent: 'Packers' }] },
  { text: 'Bears +7 vs Packers', expect: [{ sport: 'NFL', bet: 'Bears +7', opponent: 'Packers' }] },
  {
    text: 'NBA card tonight 🏀\nCeltics -4.5\nJokic o11.5 reb -120\nKnicks/Heat u212.5\n\n#BOL',
    expect: [
      { sport: 'NBA', bet: 'Celtics -4.5', market: 'spread' },
      { sport: 'NBA', bet: 'Jokic Over 11.5 Reb', market: 'prop', odds: -120 },
      { sport: 'NBA', bet: 'Knicks/Heat Under 212.5', market: 'total' },
    ],
  },
  { text: 'CFB: Duke pick\'em', expect: [{ sport: 'CFB', bet: 'Duke PK', market: 'spread' }] },
  // Recaps and chatter are not picks.
  { text: 'Chiefs -3.5 ✅ cashed', expect: [] },
  { text: 'Went 4-1 yesterday, great day fam', expect: [] },
  { text: 'Big slate tomorrow, card drops at noon', expect: [] },
]

function matches(got: ParsedPick, want: Expect): boolean {
  return Object.entries(want).every(([k, v]) => (got as any)[k] === v)
}

/** Returns failures; prints a summary when run directly. */
export function runExamples(): string[] {
  const failures: string[] = []
  for (const { text, expect } of EXAMPLES) {
    const got = parseWithRegex(text)
    const ok = got.length === expect.length && expect.every((w, i) => matches(got[i], w))
    if (!ok) failures.push(`${JSON.stringify(text)}\n  want ${JSON.stringify(expect)}\n  got  ${JSON.stringify(got)}`)
  }
  return failures
}

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('parse.examples.ts')) {
  const failures = runExamples()
  console.log(failures.length ? failures.join('\n') : `all ${EXAMPLES.length} examples pass`)
  if (failures.length) process.exitCode = 1
}
