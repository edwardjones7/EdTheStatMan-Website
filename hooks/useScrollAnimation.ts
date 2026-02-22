'use client'

import { useEffect, useRef } from 'react'

export function useScrollAnimation() {
  const elementRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '0px 0px -80px 0px',
      threshold: 0.1
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible')
          if (!entry.target.classList.contains('counter')) {
            observer.unobserve(entry.target)
          }
        }
      })
    }, observerOptions)

    const currentElement = elementRef.current
    if (currentElement) {
      observer.observe(currentElement)
    }

    return () => {
      if (currentElement) {
        observer.unobserve(currentElement)
      }
    }
  }, [])

  return elementRef
}
