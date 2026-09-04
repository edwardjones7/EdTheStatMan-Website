// Which Gemini model should EdTheStatBot actually run on today?
//
//   node --env-file=.env.local scripts/probe-statbot-models.mjs
//
// WHY THIS EXISTS: free-tier allowances are per model, wildly different, and
// not documented anywhere trustworthy -- blog posts quoting "250 requests a
// day" were off by more than 10x for gemini-3.5-flash, whose real free ceiling
// is TWENTY PER DAY. That is a demo allowance, not something a live site runs
// on, and the only way to find out was to be rate limited in production.
//
// So: ask the API instead of the internet. Each candidate gets ONE real call
// with ONE tool, which answers the three questions that matter together --
// does the id resolve, is there quota left today, and will it actually call a
// tool. A model that chats but will not call a tool is useless here, because
// every answer EdTheStatBot gives is grounded in a tool result.
//
// Costs one request per candidate against that model's own budget. Cheap, and
// it is the same budget you were about to spend finding out the hard way.
//
// Feed the winner back in as STATBOT_GOOGLE_MODEL -- see lib/ai/model.ts. That
// is an env var precisely so this is a one-line fix, not a deploy.

import { generateText, tool, stepCountIs } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod'

const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY
if (!key) {
  console.log('GOOGLE_GENERATIVE_AI_API_KEY is not set. Nothing to probe.')
  process.exit(1)
}

const google = createGoogleGenerativeAI({ apiKey: key })

// Lite-class first: it carries the larger free allowance, and this workload --
// a small toolset, typed filters, short answers -- is what Lite is for.
// `-latest` aliases are included because they never go stale.
const CANDIDATES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      'gemini-flash-lite-latest',
      'gemini-2.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-3.5-flash-lite',
      'gemini-2.5-flash',
      'gemini-flash-latest',
      'gemini-3.5-flash',
    ]

console.log('model'.padEnd(26), 'result')
console.log('-'.repeat(70))

for (const id of CANDIDATES) {
  let called = false
  try {
    const r = await generateText({
      model: google(id),
      prompt: 'What is the record? Call the tool, then state it in one short line.',
      tools: {
        get_record: tool({
          description: 'The published win/loss record for graded picks.',
          inputSchema: z.object({}),
          execute: async () => {
            called = true
            return { wins: 34, losses: 18 }
          },
        }),
      },
      stopWhen: stepCountIs(3),
      maxOutputTokens: 400,
      // No retries: a 429 here is the ANSWER, not a failure to work around.
      maxRetries: 0,
    })
    const usedIt = called && /34/.test(r.text)
    console.log(
      id.padEnd(26),
      usedIt ? 'OK   tools work' : called ? 'WEAK called the tool but ignored the result'
                                          : 'WEAK answered without calling the tool',
      `| "${r.text.trim().replace(/\s+/g, ' ').slice(0, 40)}"`
    )
  } catch (e) {
    const msg = String(e?.message ?? e)
    const limit = msg.match(/quotaValue"?\s*:?\s*"?(\d+)/)?.[1]
    const window =
      /PerDay/.test(msg) ? 'per day'
      : /PerMinute/.test(msg) ? 'per minute'
      : ''
    if (limit) {
      console.log(id.padEnd(26), `EXHAUSTED  free ceiling is ${limit} ${window}`)
    } else if (/not found|does not exist|NOT_FOUND/i.test(msg)) {
      console.log(id.padEnd(26), 'NO SUCH MODEL for this key')
    } else {
      console.log(id.padEnd(26), `FAIL  ${msg.replace(/\s+/g, ' ').slice(0, 55)}`)
    }
  }
}

console.log('\nPick an OK row with the largest allowance and set it in .env.local:')
console.log('  STATBOT_GOOGLE_MODEL=<model id>')
