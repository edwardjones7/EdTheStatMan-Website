import type { ReactNode } from 'react'

/**
 * Shell for /terms, /privacy and /responsible-gaming: the standard page
 * header, then plain prose in the blog's reading styles. Server-rendered and
 * deliberately free of reveal animations, so the text is there on first paint.
 */
export default function LegalPage({
  label,
  title,
  updated,
  children,
}: {
  label: string
  title: string
  /** "October 15, 2026" */
  updated: string
  children: ReactNode
}) {
  return (
    <main>
      <header className="page-header">
        <div className="container" style={{ textAlign: 'center' }}>
          <span className="section-label">{label}</span>
          <h1 className="page-header__title">{title}</h1>
          <p className="page-header__subtitle">Last updated {updated}</p>
        </div>
      </header>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container" style={{ maxWidth: '760px' }}>
          <div className="blog-post__content legal-page">{children}</div>
        </div>
      </section>
    </main>
  )
}
