import { revalidatePath } from 'next/cache'
import { invalidate, DB_TAGS } from '@/lib/supabase/cached'

/**
 * Every /picks/[slug] page is cached (ISR). A pick saved, graded
 * or deleted in the admin should show there now, not when the cache next
 * expires -- grading is the moment a members' pick's bet is revealed, and the
 * moment the records move.
 */
export function revalidatePublicPicks(): void {
  // The homepage, Portfolio, results and Desk read picks through the cached
  // client (lib/supabase/cached.ts); drop those too.
  invalidate(DB_TAGS.picks)
  try {
    revalidatePath('/picks/[slug]', 'page')
  } catch {
    // Outside a request (a script), there is no cache to clear.
  }
}
