'use client'

import { useEffect } from 'react'
import { trackEvent } from '@/lib/track-client'

/**
 * Records `paywall_view` when a lock or gate renders. Renders nothing.
 *
 * ONCE PER PAGE PER GATE KIND, not once per card. The Vault puts up to a dozen
 * locked teaser cards in one grid; one event per card would make a single
 * visit look like twelve paywall hits and swamp the funnel. The set below lives
 * for the page load, so a client-side navigation to another page counts again,
 * which is what a fresh paywall view is.
 */
const seen = new Set<string>()

export default function PaywallView({ gate, tier }: { gate: string; tier?: string | null }) {
  useEffect(() => {
    const key = `${window.location.pathname}|${gate}|${tier ?? ''}`
    if (seen.has(key)) return
    seen.add(key)
    trackEvent('paywall_view', { gate, tier: tier ?? null })
  }, [gate, tier])
  return null
}
