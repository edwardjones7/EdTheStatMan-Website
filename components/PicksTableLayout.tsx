/**
 * Shared column geometry for the two picks tables (TodaysBets and
 * RecentPicksResults), which render the same eight columns.
 *
 * These tables used to run on the browser's automatic layout, which sizes each
 * column to its content. One long note was enough to blow the Note column out
 * to half the table and crush the other seven into a narrow band on the left.
 * Fixed layout plus these percentages means a note never changes the shape of
 * the table — it just wraps inside the width it was given.
 */
export const PICKS_TABLE_STYLE: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  tableLayout: 'fixed',
  // Below this the columns get too tight to read, so the wrapper scrolls.
  minWidth: '780px',
}

/** Widths sum to 100 in both variants, so the table always fills its container. */
const COLS = ['12%', '8%', '13%', '10%', '11%', '12%', '10%', '24%']
const COLS_WITH_ACTIONS = ['11%', '7%', '12%', '9%', '10%', '11%', '9%', '21%', '10%']

export function PicksTableCols({ showActions = false }: { showActions?: boolean }) {
  return (
    <colgroup>
      {(showActions ? COLS_WITH_ACTIONS : COLS).map((w, i) => (
        <col key={i} style={{ width: w }} />
      ))}
    </colgroup>
  )
}

/** The Note cell: the one column whose content is prose and has to wrap. */
export const noteCellStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: '0.85rem',
  lineHeight: 1.5,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}
