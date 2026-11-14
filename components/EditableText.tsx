'use client'

import { useRef, useLayoutEffect } from 'react'

interface Props {
  tag?: keyof JSX.IntrinsicElements
  value: string
  onChange: (v: string) => void
  resetKey: number
  className?: string
  style?: React.CSSProperties
}

// Renders the element exactly like the original but with contentEditable.
// Uses useLayoutEffect to set innerText only on mount / resetKey change,
// so React never clobbers the user's in-progress edits.
export default function EditableText({
  tag = 'span',
  value,
  onChange,
  resetKey,
  className,
  style,
}: Props) {
  const ref = useRef<HTMLElement>(null)
  const Tag = tag as any

  useLayoutEffect(() => {
    if (ref.current) ref.current.innerText = value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  return (
    <Tag
      ref={ref}
      className={[className, 'akit-editable'].filter(Boolean).join(' ')}
      contentEditable
      suppressContentEditableWarning
      // On every keystroke, not on blur: the admin bar's Save button enables
      // as soon as something changes, instead of after clicking away first.
      // Safe because the text node is only ever written on mount / resetKey.
      onInput={(e: React.FormEvent<HTMLElement>) => onChange(e.currentTarget.innerText)}
      style={{
        cursor: 'text',
        minWidth: '20px',
        display: 'inline-block',
        ...style,
      }}
    />
  )
}
