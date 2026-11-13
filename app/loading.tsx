import '@/styles/loading.css'

/**
 * The fallback while any page without its own loading.tsx renders (the
 * Research Desk has a skeleton of its own). Next shows this the instant a link
 * is clicked, instead of leaving the old page on screen with no sign of life.
 */
export default function Loading() {
  return (
    <main className="page-loading" aria-busy="true" aria-live="polite">
      <span className="page-loading__ring" aria-hidden="true" />
      <span className="page-loading__label">Loading</span>
    </main>
  )
}
