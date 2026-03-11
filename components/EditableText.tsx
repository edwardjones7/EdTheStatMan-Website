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
      className={className}
      contentEditable
      suppressContentEditableWarning
      onBlur={(e: React.FocusEvent<HTMLElement>) => {
        const text = e.currentTarget.innerText
        if (text !== value) onChange(text)
      }}
      style={{
        outline: 'none',
        borderBottom: '1px dashed rgba(52,211,153,0.45)',
        borderRadius: '2px',
        cursor: 'text',
        minWidth: '20px',
        display: 'inline-block',
        ...style,
      }}
    />
  )
}
