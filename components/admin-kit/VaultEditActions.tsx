'use client'

import { AdminActions, useAdminKit } from './AdminKit'

/**
 * The Vault editors' controls, in the admin bar: switch edit mode on and off,
 * add a row, import a spreadsheet, and clear the table. Shared by systems and
 * trends so both pages behave the same.
 */
export default function VaultEditActions({
  noun, editing, setEditing, onAdd, addDisabled, onImport, onClearAll, total,
}: {
  noun: 'system' | 'trend'
  editing: boolean
  setEditing: (on: boolean) => void
  onAdd: () => void
  addDisabled?: boolean
  onImport: () => void
  /** Deletes every row. Only called after the admin confirms. */
  onClearAll: () => Promise<void>
  total: number
}) {
  const kit = useAdminKit()
  if (!kit) return null
  const plural = `${noun}s`

  async function clearAll() {
    const ok = await kit!.confirm({
      title: `Delete all ${total.toLocaleString()} ${plural}?`,
      body: <>Every {noun} in every league comes out of the Vault, and the Desk loses its {noun} matches. This can&rsquo;t be undone. Import a spreadsheet afterwards to put rows back.</>,
      confirm: `Delete all ${plural}`,
      danger: true,
    })
    if (!ok) return
    try {
      await onClearAll()
      kit!.toast(`Deleted all ${plural}`)
    } catch {
      kit!.toast(`Couldn’t delete the ${plural}`, 'error')
    }
  }

  return (
    <AdminActions>
      {editing ? (
        <>
          <button type="button" className="akit-btn akit-btn--primary" onClick={onAdd} disabled={addDisabled}>+ Add {noun}</button>
          <button type="button" className="akit-btn" onClick={onImport}>Import XLSX</button>
          <button type="button" className="akit-btn akit-btn--ghost" onClick={() => void clearAll()}>Clear all…</button>
          <button type="button" className="akit-btn" onClick={() => setEditing(false)}>Done editing</button>
        </>
      ) : (
        <button type="button" className="akit-btn akit-btn--primary" onClick={() => setEditing(true)}>Edit {plural}</button>
      )}
    </AdminActions>
  )
}
