'use client'

import { useEffect, useState } from 'react'

interface Props {
  phrases: string[]
}

const FADE = 450 // fade in/out duration (keep in sync with CSS transition)
const HOLD = 2000 // time a phrase stays fully visible

// Renders a gradient accent line that fades each phrase out and the next in,
// cycling through the list. SSR-stable: phrase[0] renders fully visible on the
// server and on first client paint; the rotation only starts after mount.
export default function TypewriterRotator({ phrases }: Props) {
  const list = phrases.length ? phrases : ['']
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  const [animate, setAnimate] = useState(false)

  // Gate animation to the client and respect reduced motion.
  useEffect(() => {
    if (list.length < 2) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setAnimate(true)
  }, [list.length])

  useEffect(() => {
    if (!animate) return
    let i = 0
    let swap: ReturnType<typeof setTimeout>

    const cycle = () => {
      setVisible(false) // fade current phrase out
      swap = setTimeout(() => {
        i = (i + 1) % list.length
        setIndex(i)
        setVisible(true) // fade next phrase in
      }, FADE)
    }

    const interval = setInterval(cycle, HOLD + FADE)
    return () => {
      clearInterval(interval)
      clearTimeout(swap)
    }
    // list is server-provided and stable per page load; omitting it avoids
    // restarting the loop on unrelated re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate])

  return (
    <span className="hero__rotator">
      <span className={`accent hero__rotator-word${visible ? ' is-visible' : ''}`}>{list[index]}</span>
    </span>
  )
}
