/**
 * Has picks_01_engine.sql been applied?
 *
 * Same probe-and-degrade rule as hasDeskColumns() in lib/desk-sync.ts: the code
 * deploy and the SQL must never have to land together. A select of a missing
 * column errors, so the probe is one cheap query.
 *
 * A positive answer is remembered for the life of the server instance -- a
 * column does not un-exist -- but a negative one is not, so the first request
 * after the migration lands sees it without a redeploy.
 */

let engineColumns = false
let draftsTable = false

/** todays_bets.slug / odds / market / posted_at / source / x_post_id. */
export async function hasPickEngineColumns(admin: any): Promise<boolean> {
  if (engineColumns) return true
  const { error } = await admin.from('todays_bets').select('slug').limit(1)
  engineColumns = !error
  return engineColumns
}

/** The review queue table. */
export async function hasPickDrafts(admin: any): Promise<boolean> {
  if (draftsTable) return true
  const { error } = await admin.from('pick_drafts').select('id').limit(1)
  draftsTable = !error
  return draftsTable
}

export const MIGRATION_MISSING =
  'picks_01_engine.sql has not been applied, so the pick queue has nowhere to live yet.'
