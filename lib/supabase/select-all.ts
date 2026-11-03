/**
 * Every row a query matches, read a page at a time.
 *
 * PostgREST caps a response at the project's max-rows setting (1,000 here) and
 * says nothing about it: a season-wide read of nfl_games simply comes back
 * short. That silently cut the CFB rail off before the bowls, the NBA rail off
 * in March, and the sitemap at exactly 1,000 games. Anything that reads "the
 * whole season" goes through this instead.
 *
 * `build` must return a fresh query each call -- a supabase-js builder is
 * consumed once it is awaited -- and must include a stable `.order()`, or
 * pages can overlap and skip rows.
 */
const PAGE = 1000

export async function selectAll<T = any>(
  build: () => any
): Promise<{ data: T[]; error: { message: string } | null }> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1)
    if (error) return { data: out, error }
    out.push(...(data ?? []))
    if (!data || data.length < PAGE) return { data: out, error: null }
  }
}
