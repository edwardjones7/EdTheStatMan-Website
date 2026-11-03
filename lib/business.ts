/**
 * Who runs the site, for legal pages and email footers.
 *
 * CAN-SPAM requires a valid postal address in every commercial email (the
 * teaser alerts sent to free accounts count). It lives in an env var rather
 * than here so it can be set in Vercel without a deploy. A PO box or virtual
 * mailbox qualifies. Until it is set, emails go out without one -- printing a
 * placeholder would be worse than printing nothing.
 */
export const BUSINESS_NAME = 'EdTheStatMan'
export const BUSINESS_STATE = 'New Jersey'
export const BUSINESS_POSTAL_ADDRESS: string | null =
  process.env.BUSINESS_POSTAL_ADDRESS?.trim() || null

/** New Jersey requires the helpline on gambling advertising. */
export const PROBLEM_GAMBLING_LINE = 'Gambling problem? Call 1-800-GAMBLER.'
