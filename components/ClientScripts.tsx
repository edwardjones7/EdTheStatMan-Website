'use client'

import { useEffect } from 'react'

export default function ClientScripts() {
  useEffect(() => {
    // Scroll animations
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

    document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale, .stagger-children').forEach(el => {
      observer.observe(el)
    })

    // System bars animation
    const barObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const target = (entry.target as HTMLElement).dataset.width
          if (target) {
            (entry.target as HTMLElement).style.width = target + '%'
            barObserver.unobserve(entry.target)
          }
        }
      })
    }, { threshold: 0.3 })

    document.querySelectorAll('.system-card__bar-fill, .sys-card__bar-fill').forEach(bar => {
      barObserver.observe(bar)
    })

    // Counter animations
    const counters = document.querySelectorAll('[data-count]')
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !(entry.target as HTMLElement).dataset.counted) {
          animateCounter(entry.target as HTMLElement)
          ;(entry.target as HTMLElement).dataset.counted = 'true'
        }
      })
    }, { threshold: 0.5 })

    counters.forEach(counter => counterObserver.observe(counter))

    function animateCounter(element: HTMLElement) {
      const target = parseFloat(element.dataset.count || '0')
      const duration = 2000
      const start = performance.now()
      const prefix = element.dataset.prefix || ''
      const suffix = element.dataset.suffix || ''
      const decimals = element.dataset.decimals ? parseInt(element.dataset.decimals) : 0

      function update(currentTime: number) {
        const elapsed = currentTime - start
        const progress = Math.min(elapsed / duration, 1)
        const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
        const current = target * eased

        element.textContent = prefix + current.toFixed(decimals) + suffix

        if (progress < 1) {
          requestAnimationFrame(update)
        }
      }

      requestAnimationFrame(update)
    }

    // Smooth anchor scrolling
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href')
        if (targetId === '#') return

        const target = document.querySelector(targetId)
        if (target) {
          e.preventDefault()
          const offset = 80
          const top = target.getBoundingClientRect().top + window.pageYOffset - offset
          window.scrollTo({ top, behavior: 'smooth' })
        }
      })
    })

    return () => {
      observer.disconnect()
      barObserver.disconnect()
      counterObserver.disconnect()
    }
  }, [])

  return null
}
