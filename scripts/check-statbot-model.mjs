// Does EdTheStatBot's model actually work with the credentials on this machine?
//
//   node --env-file=.env.local scripts/check-statbot-model.mjs
//
// Checks three things in order, because they fail for different reasons and the
// error you get from the third is useless if the first is broken:
//
//   1. a credential is present at all
//   2. the model answers a trivial prompt        -> auth, model id, billing
//   3. the model calls a TOOL and uses the result -> the thing the bot needs
//
// Step 3 is the one that matters and the one a provider swap breaks. Every
// answer EdTheStatBot gives is grounded in a tool result; a model that chats
// fine but will not call a tool is useless here and looks like it is working.

import { generateText, tool, stepCountIs } from 'ai'
import { z } from 'zod'

const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
const gatewayKey = process.env.AI_GATEWAY_API_KEY
const oidc = process.env.VERCEL_OIDC_TOKEN

console.log('--- 1. credentials ---')
console.log('  GOOGLE_GENERATIVE_AI_API_KEY:', googleKey ? 'set' : 'absent')
console.log('  AI_GATEWAY_API_KEY:          ', gatewayKey ? 'set' : 'absent')
console.log('  VERCEL_OIDC_TOKEN:           ', oidc ? 'present' : 'absent')

if (!googleKey && !gatewayKey && !oidc) {
  console.log('\nNo credential of any kind. Nothing to test.')
  process.exit(1)
}

let model
let label
if (googleKey) {
  const { createGoogleGenerativeAI } = await import('@ai-sdk/google')
  const id = process.env.STATBOT_GOOGLE_MODEL || 'gemini-3.5-flash'
  model = createGoogleGenerativeAI({ apiKey: googleKey })(id)
  label = `google:${id}`
} else {
  model = 'anthropic/claude-sonnet-5'
  label = `gateway:${model}`
}
console.log('  -> using', label)

// --- 2. can it answer at all? --------------------------------------------
console.log('\n--- 2. plain generation ---')
try {
  // maxOutputTokens must leave room for the model's internal reasoning as well
  // as the answer. Flash-class Gemini spends output budget on thinking, so a
  // tight cap returns an empty string with no error -- which is why the empty
  // case below is a FAIL and not a pass.
  const r = await generateText({
    model,
    prompt: 'Reply with exactly: OK',
    maxOutputTokens: 512,
  })
  const text = r.text.trim()
  console.log('  reply:', JSON.stringify(text))
  console.log('  finish reason:', r.finishReason)
  if (!text) {
    console.log('  FAIL -- empty response. The model answered but produced no text;')
    console.log('          usually maxOutputTokens consumed by reasoning, or a content filter.')
    process.exit(1)
  }
  console.log('  PASS')
} catch (e) {
  console.log('  FAIL:', e?.message ?? e)
  const body = e?.responseBody ?? e?.cause?.responseBody
  if (body) console.log('  body:', String(body).slice(0, 400))
  console.log('\nStop here. Nothing below will work until this does.')
  process.exit(1)
}

// --- 3. will it call a tool and use what comes back? ---------------------
console.log('\n--- 3. tool calling ---')
let called = false
try {
  const r = await generateText({
    model,
    prompt: 'What is the win/loss record? Use the tool. Then state the record and nothing else.',
    tools: {
      get_record: tool({
        description: 'The published win/loss record for graded picks.',
        inputSchema: z.object({
          sport: z.string().optional().describe('Filter to one sport.'),
        }),
        execute: async () => {
          called = true
          return { wins: 34, losses: 18, winPct: 65.4 }
        },
      }),
    },
    stopWhen: stepCountIs(4),
    maxOutputTokens: 200,
  })
  console.log('  tool was called:', called)
  console.log('  reply:', JSON.stringify(r.text.trim().slice(0, 200)))
  const usedIt = /34/.test(r.text) && /18/.test(r.text)
  console.log(called && usedIt ? '  PASS' : '  FAIL -- model did not call the tool or ignored its result')
  process.exit(called && usedIt ? 0 : 1)
} catch (e) {
  console.log('  FAIL:', e?.message ?? e)
  const body = e?.responseBody ?? e?.cause?.responseBody
  if (body) console.log('  body:', String(body).slice(0, 400))
  process.exit(1)
}
