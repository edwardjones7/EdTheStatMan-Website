// EdTheStatBot's memory between page loads.
//
// The panel lives in the root layout, so it already survives client-side
// navigation -- the layout does not remount. What it did NOT survive was a hard
// reload, a new tab, or coming back tomorrow, and a bot that forgets the
// question you asked ninety seconds ago on the previous page does not read as
// "the analyst who is with you on every part of the site".
//
// ONE rolling thread per member, not a thread list. See the rationale in
// supabase/migrations/ai_usage_02_anon_and_threads.sql. Anonymous callers get
// nothing here: they have no id to key a row by, and their five-message
// allowance does not outlive the tab.

import { createAdminClient } from '@/lib/supabase/admin'
import type { UIMessage } from 'ai'

/**
 * Turns kept. Twelve exchanges is well past the point where a corner-panel
 * conversation is still about one thing, and it bounds both the jsonb column
 * and the prompt we replay into the model.
 */
const MAX_STORED_MESSAGES = 24

/**
 * Strip everything from a message except what the panel needs to redraw it.
 *
 * THE IMPORTANT PART: tool `input` and `output` are dropped. export_vault
 * returns up to 2000 rows of CSV inside a tool part, and search_vault returns
 * full row objects -- persisting those verbatim would put megabytes of Vault
 * data into a jsonb column on every message, and would re-serve it to the
 * browser on the next page load without re-checking entitlement. A member who
 * downgrades must not get yesterday's Institutional export handed back to them
 * out of their own thread history.
 *
 * The part TYPE is kept, so the "which tool ran" chip still renders on reload
 * with the payload gone.
 */
function slimMessage(m: UIMessage): UIMessage {
  const parts = (m.parts ?? [])
    .map((part: any) => {
      if (part?.type === 'text') return { type: 'text', text: String(part.text ?? '') }
      if (typeof part?.type === 'string' && part.type.startsWith('tool-')) {
        return { type: part.type, state: 'output-available', toolCallId: part.toolCallId }
      }
      // Reasoning, files, step markers, custom data parts: not rendered by the
      // panel and not worth storing. Anything new lands here by default, which
      // is the safe direction for a store that must never leak gated payloads.
      return null
    })
    .filter(Boolean)

  return { id: m.id, role: m.role, parts } as UIMessage
}

/**
 * Trim to the tail, then drop any leading assistant turns so the stored thread
 * always opens on a question. A thread starting mid-answer replays as an
 * assistant message with no prompt, which some providers reject outright.
 */
function trim(messages: UIMessage[]): UIMessage[] {
  const tail = messages.slice(-MAX_STORED_MESSAGES)
  const firstUser = tail.findIndex(m => m.role === 'user')
  return firstUser <= 0 ? tail : tail.slice(firstUser)
}

/**
 * The member's stored thread, ready to hand to useChat as initial messages.
 *
 * Returns [] on any failure, including the table not existing yet --
 * ai_usage_02_anon_and_threads.sql is applied by hand, and a bot that refuses
 * to open because it cannot remember is worse than one that starts fresh.
 */
export async function loadThread(userId: string): Promise<UIMessage[]> {
  try {
    const admin = createAdminClient() as any
    const { data, error } = await admin
      .from('ai_threads')
      .select('messages')
      .eq('user_id', userId)
      .maybeSingle()

    if (error || !data) return []
    const messages = data.messages
    if (!Array.isArray(messages)) return []
    return trim(messages as UIMessage[])
  } catch {
    return []
  }
}

/**
 * Persist the thread after a response finishes. Best effort in every direction:
 * the user already has their answer, and nothing downstream depends on this.
 */
export async function saveThread(userId: string, messages: UIMessage[]): Promise<void> {
  try {
    const admin = createAdminClient() as any
    await admin
      .from('ai_threads')
      .upsert(
        {
          user_id: userId,
          messages: trim(messages).map(slimMessage),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
  } catch (e: any) {
    console.error(`[statbot] thread save failed: ${e?.message}`)
  }
}

/** Wipe the thread. Backs the panel's "New chat" control. */
export async function clearThread(userId: string): Promise<void> {
  const admin = createAdminClient() as any
  await admin.from('ai_threads').delete().eq('user_id', userId)
}
