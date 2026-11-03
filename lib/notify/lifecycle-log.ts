// Bookkeeping around lifecycle mail: the once-only guard (email_log) and the
// 'purchase' funnel event. Server only -- every function takes the service-role
// client, because neither table has a policy a member could write through.
//
// Like the rest of lib/notify, nothing here throws. Both callers would rather
// lose an email or an analytics row than fail a webhook or a cron run.

import type { LifecycleKind } from './lifecycle'

/**
 * PostgREST's "relation does not exist" answers. email_log arrives with
 * supabase/migrations/lifecycle_01_email_log.sql, applied by hand, so code that
 * deploys first has to treat a missing table as "not yet" rather than a fault.
 */
function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return error.code === '42P01' || error.code === 'PGRST205' ||
    /does not exist|could not find the table/i.test(error.message ?? '')
}

/** True once lifecycle_01_email_log.sql has been applied. */
export async function emailLogReady(admin: any): Promise<boolean> {
  try {
    const { error } = await admin.from('email_log').select('id', { head: true, count: 'exact' }).limit(1)
    if (!error) return true
    if (!isMissingTable(error)) console.error(`[lifecycle] email_log probe failed: ${error.message}`)
    return false
  } catch (e: any) {
    console.error(`[lifecycle] email_log probe threw: ${e?.message}`)
    return false
  }
}

export type Claim = 'claimed' | 'already-sent' | 'unavailable'

/**
 * Reserve (user, kind, ref) BEFORE sending, insert-first like stripe_events:
 * the unique constraint is what makes "send once" true under a retried cron or
 * two overlapping runs, which a select-then-insert could not promise.
 *
 * 'unavailable' means the table is missing or the insert failed for another
 * reason; the caller decides whether sending without a guard is acceptable.
 */
export async function claimEmail(admin: any, userId: string, kind: LifecycleKind, ref: string): Promise<Claim> {
  try {
    const { error } = await admin.from('email_log').insert({ user_id: userId, kind, ref })
    if (!error) return 'claimed'
    if (error.code === '23505') return 'already-sent'
    if (!isMissingTable(error)) console.error(`[lifecycle] email_log claim failed (${error.code}): ${error.message}`)
    return 'unavailable'
  } catch (e: any) {
    console.error(`[lifecycle] email_log claim threw: ${e?.message}`)
    return 'unavailable'
  }
}

/**
 * Give a claim back after the send itself failed, so the next run retries
 * instead of the reservation silently standing in for an email nobody got.
 */
export async function releaseEmail(admin: any, userId: string, kind: LifecycleKind, ref: string): Promise<void> {
  try {
    await admin.from('email_log').delete().eq('user_id', userId).eq('kind', kind).eq('ref', ref)
  } catch (e: any) {
    console.error(`[lifecycle] email_log release threw: ${e?.message}`)
  }
}

/**
 * The 'purchase' funnel event (lib/funnel-events.ts). Server-written so it
 * counts only payments Stripe actually confirmed, never a click on a button.
 */
export async function recordPurchaseEvent(admin: any, input: {
  userId: string
  tier: string
  period: 'month' | 'year' | 'season' | null
  amountCents: number | null | undefined
  currency?: string | null
}): Promise<void> {
  try {
    const { error } = await admin.from('events').insert({
      event_type: 'purchase',
      path: null,
      visitor_id: null,
      user_id: input.userId,
      meta: {
        tier: input.tier,
        period: input.period,
        amount: input.amountCents ?? null,
        currency: input.currency ?? 'usd',
      },
    })
    if (error) console.error(`[lifecycle] purchase event insert failed (${error.code}): ${error.message}`)
  } catch (e: any) {
    console.error(`[lifecycle] purchase event insert threw: ${e?.message}`)
  }
}
