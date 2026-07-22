// Validates post-auth redirect targets. Anything that could leave the origin is
// rejected — an attacker-controlled `next` on an auth callback is a phishing
// primitive ("sign in on the real site, get bounced to a fake one").

const MAX_LENGTH = 512

export function safeNext(next: string | null | undefined, fallback = '/'): string {
  if (!next) return fallback
  if (next.length > MAX_LENGTH) return fallback

  let value = next
  try {
    // One decode pass: `%2F%2Fevil.com` would otherwise slip past the `//` check.
    value = decodeURIComponent(next)
  } catch {
    return fallback
  }

  if (!value.startsWith('/')) return fallback
  // `//evil.com` is protocol-relative; `/\evil.com` is normalised to it by browsers.
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback
  if (value.includes('://')) return fallback
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(value)) return fallback

  return value
}
