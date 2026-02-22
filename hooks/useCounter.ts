'use client'

import { useState, useEffect, useRef } from 'react'

interface UseCounterProps {
  target: number
  prefix?: string
  suffix?: string
  decimals?: number
  duration?: number
}

export function useCounter({ target, prefix = '', suffix = '', decimals = 0, duration = 2000 }: UseCounterProps) {
  const [count, setCount] = useState(0)
  const hasAnimated = useRef(false)

  useEffect(() => {
    if (hasAnimated.current) return
    
    const startTime = performance.now()
    
    const update = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      const current = target * eased
      
      setCount(current)
      
      if (progress < 1) {
        requestAnimationFrame(update)
      } else {
        hasAnimated.current = true
      }
    }
    
    requestAnimationFrame(update)
  }, [target, duration])

  return `${prefix}${count.toFixed(decimals)}${suffix}`
}
