import { revalidatePath } from 'next/cache'

/**
 * /picks and every /picks/[slug] page are cached (ISR). A pick saved, graded
 * or deleted in the admin should show there now, not when the cache next
 * expires -- grading is the moment a members' pick's bet is revealed, and the
 * moment the records move.
 */
export function revalidatePublicPicks(): void {
  try {
    revalidatePath('/picks')
    revalidatePath('/picks/[slug]', 'page')
  } catch {
    // Outside a request (a script), there is no cache to clear.
  }
}
