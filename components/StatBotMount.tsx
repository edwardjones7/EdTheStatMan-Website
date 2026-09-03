import StatBot from './StatBot'
import { getAccess } from '@/lib/access-server'
import { TIER_SHORT_LABEL } from '@/lib/access'

/**
 * Server wrapper that resolves the caller's rung once, in the layout, and hands
 * the client component only the tier string.
 *
 * NOTHING HERE IS LOAD-BEARING FOR SECURITY. The toolset is rebuilt server-side
 * per request in /api/statbot from the session, not from these props; a browser
 * that posts `tier: 'institutional'` at the API gets whatever its cookie is
 * actually worth. This only decides what to render and which prompts to suggest.
 *
 * Renders for signed-out visitors too. They get `tier: null`, which the API
 * turns into a two-tool, five-messages-a-day toolset -- the bot is on every
 * page, including the ones people land on before they have an account.
 *
 * Deliberately does NOT load the stored conversation. This runs in the root
 * layout on every route; the panel fetches its own thread from
 * /api/statbot/thread the first time it is opened, so the ~95% of page views
 * that never open it pay nothing.
 */
export default async function StatBotMount() {
  const access = await getAccess()

  return (
    <StatBot
      tier={access.tier}
      tierLabel={
        access.isAdmin ? 'Admin'
        : access.tier ? TIER_SHORT_LABEL[access.tier]
        : 'Guest'
      }
    />
  )
}
