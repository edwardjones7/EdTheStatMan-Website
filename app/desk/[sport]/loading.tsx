/**
 * Loading UI for the Research Desk.
 *
 * Next wraps the page segment in a Suspense boundary when this file exists, so
 * it covers both cases that made the board feel stuck:
 *
 *   - client navigation, where nothing used to change on screen until the
 *     server had finished every query and the old page just sat there
 *   - a hard load, where the shell now streams immediately and the real board
 *     replaces this when the data lands
 *
 * The page is `force-dynamic` and does four round trips (auth, the full game
 * list, the curated link counts, the desk note), so there is always something
 * to cover — this is not hiding a fixable delay, it is refusing to show a blank
 * frame during one that is inherent to rendering per-visitor content.
 *
 * Geometry mirrors the real board deliberately: same section padding, same pill
 * row, same four-cell stat strip, same card block. If these drift apart the
 * page will visibly jump when the real content swaps in, which is the exact
 * thing this file exists to prevent.
 *
 * No props: Next passes none to loading.tsx, so this cannot name the sport and
 * the heading is a bar rather than text.
 */
export default function Loading() {
  return (
    <main aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the schedule</span>

      <section className="section" style={{ paddingBottom: '40px' }}>
        <div className="container">

          {/* Header: label, title, two subtitle lines. */}
          <div className="desk-skel__head">
            <div className="skeleton desk-skel__label" />
            <div className="skeleton desk-skel__title" />
            <div className="skeleton desk-skel__sub" />
            <div className="skeleton desk-skel__sub desk-skel__sub--short" />
          </div>

          {/* Week pills. */}
          <div className="desk-skel__weeks">
            {Array.from({ length: 13 }).map((_, i) => (
              <div key={i} className="skeleton desk-skel__pill" />
            ))}
          </div>

          {/* The four-cell stat strip. */}
          <div className="desk-skel__stats">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="desk-skel__stat">
                <div className="skeleton desk-skel__stat-n" />
                <div className="skeleton desk-skel__stat-l" />
              </div>
            ))}
          </div>

          {/* Two day groups, matching how a real week breaks up. */}
          {Array.from({ length: 2 }).map((_, d) => (
            <div key={d} className="desk-skel__day">
              <div className="skeleton desk-skel__dayhead" />
              <div className="desk-skel__grid">
                {Array.from({ length: d === 0 ? 1 : 3 }).map((_, i) => (
                  <div key={i} className="desk-skel__card">
                    <div className="skeleton desk-skel__card-top" />
                    <div className="desk-skel__card-side">
                      <div className="skeleton desk-skel__logo" />
                      <div className="skeleton desk-skel__team" />
                    </div>
                    <div className="desk-skel__card-side">
                      <div className="skeleton desk-skel__logo" />
                      <div className="skeleton desk-skel__team" />
                    </div>
                    <div className="skeleton desk-skel__card-odds" />
                    <div className="skeleton desk-skel__card-foot" />
                  </div>
                ))}
              </div>
            </div>
          ))}

        </div>
      </section>
    </main>
  )
}
