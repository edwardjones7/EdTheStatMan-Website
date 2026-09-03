import { getAccessWithProfile } from '@/lib/access-server'
import { loadThread, clearThread } from '@/lib/ai/thread'

/**
 * The caller's own stored EdTheStatBot conversation.
 *
 * LAZY ON PURPOSE. The obvious alternative was to load the thread server-side in
 * StatBotMount and pass it as props, which needs no endpoint at all -- but that
 * mount sits in the ROOT LAYOUT, so it would put a database round trip on the
 * render path of every page on the site to populate a panel that most visits
 * never open. Fetching on first open moves that cost to the handful of sessions
 * that actually want it.
 *
 * Both handlers key off the session, never off the request: there is no id
 * parameter here and there must never be one, or this becomes a way to read
 * somebody else's conversation.
 */
export async function GET() {
  const { userId } = await getAccessWithProfile()
  // Signed-out conversations were never stored -- an empty thread is the
  // truthful answer, not an error.
  if (!userId) return Response.json({ messages: [] })

  return Response.json({ messages: await loadThread(userId) })
}

/** Wipe the stored thread. Backs the panel's "New chat" control. */
export async function DELETE() {
  const { userId } = await getAccessWithProfile()
  if (!userId) {
    // Nothing stored to clear; saying so is more honest than a silent 200.
    return Response.json({ error: 'Not signed in.' }, { status: 401 })
  }

  try {
    await clearThread(userId)
  } catch (e: any) {
    console.error(`[statbot] thread clear failed: ${e?.message}`)
    return Response.json({ error: 'Could not clear the conversation.' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
