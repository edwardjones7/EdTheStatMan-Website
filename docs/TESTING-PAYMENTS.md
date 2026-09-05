# End-to-end payment rehearsal (test mode)

Prove the ladder sells and grants correctly **before** `main` and before a
single live price exists. Nothing here touches real money.

> **`.env.local` holds a `sk_live_` key.** A checkout driven against the file as
> it currently stands takes a real payment from a real card. Step 2 swaps that
> key out and step 9 puts it back. Do not skip either.

## What is already true

- The ladder migrations (01-06) are applied **in production**, so the schema the
  webhook needs -- `pass_tier`, `sub_tier`, `recompute_entitlement()`,
  `stripe_events` -- is live.
- `.env.local` points at that same production Supabase project. There is no
  second database. This rehearsal therefore writes real rows to `profiles`,
  `purchases` and `stripe_events` for **one throwaway account**, and step 8
  removes them.
- `npm run build` is clean on `v3-tier-ladder`.

Testing against production data is the pragmatic call, not the ideal one. The
alternative is a Supabase branch, which means re-applying ~24 migration files by
hand because this repo has no migration runner. The containment is that every
write is keyed to one test user id, and the cleanup in step 8 is exact.

> The one thing that escapes that containment: `getGlobalTotals()` sums
> `purchases.amount_cents` across **all** rows for the admin dashboard's
> all-time revenue. A test purchase inflates that number until step 8 runs.

---

## Setup

**1. Back up the live env, and install the CLI.**

```bash
cp .env.local .env.local.live-backup      # .env* is gitignored
```

Install the Stripe CLI (`scoop install stripe`, or the Windows release from
stripe.com/docs/stripe-cli), then `stripe login`.

**2. Get a test key and create the test prices.**

Stripe dashboard, toggle to **Test mode**, Developers -> API keys, copy the
`sk_test_...` secret. Add it to `.env.local`:

```
STRIPE_TEST_SECRET_KEY=sk_test_...
```

```bash
node scripts/create-stripe-prices.mjs            # dry run, test mode is default
node scripts/create-stripe-prices.mjs --write    # creates the 8 test prices
```

It prints an env block. In `.env.local`, paste those eight `NEXT_PUBLIC_*` lines
and **change `STRIPE_SECRET_KEY` to the `sk_test_` value**. `lib/stripe.ts` reads
`STRIPE_SECRET_KEY`, not the test variable, so the swap is what puts the whole
app in test mode. Live price IDs and test price IDs are not interchangeable: a
live key with a test price fails the checkout outright.

**3. Forward webhooks.**

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

It prints `whsec_...`. Put that in `STRIPE_WEBHOOK_SECRET`.

> This also works around a real bug. `.env.local` currently has
> `STRIPE_WEBHOOK_SECRET=we_1TBgF...`, which is a webhook **endpoint ID**, not a
> signing secret. Signing secrets are `whsec_` + 32 chars. Every
> `constructEvent()` call against that value fails signature verification.
> **Check whether Vercel's copy has the same paste error** -- if it does,
> production webhooks have never verified.

**4. `npm run dev`**, and sign up a throwaway account. Note its user id:

```sql
SELECT id, email FROM public.profiles WHERE email = 'you+test@example.com';
```

---

## The matrix

Card `4242 4242 4242 4242`, any future expiry, any CVC.

Buy each SKU from `/win` and assert after each. Reset with step 8's cleanup
between rungs, or the anti-downgrade guard will legitimately block the next one.

| # | SKU | Mode | Expect on `profiles` |
|---|---|---|---|
| 1 | Portfolio month $49 | payment | `pass_tier=portfolio`, `pass_expires_at` = +30d, `billing_mode=pass` |
| 2 | Portfolio season $199 | payment | `pass_tier=portfolio`, `pass_expires_at=2027-02-15T12:00Z` |
| 3 | Desk month $129 | **subscription** | `sub_tier=desk`, `sub_current_period_end` = +1mo, `billing_mode=subscription` |
| 4 | Desk season $499 | payment | `pass_tier=desk`, `pass_expires_at=2027-02-15T12:00Z` |
| 5 | Private month $199 | **subscription** | `sub_tier=private` |
| 6 | Private season $799 | payment | `pass_tier=private` |
| 7 | Institutional month $399 | **subscription** | `sub_tier=institutional` |
| 8 | Institutional season $1,499 | payment | `pass_tier=institutional` |

After every one, `subscription_tier` and `access_expires_at` are **derived** --
never written by a handler -- so check they match the highest active slot.

```sql
SELECT email, subscription_tier, access_expires_at,
       pass_tier, pass_expires_at, sub_tier, sub_current_period_end, billing_mode
FROM public.profiles WHERE id = '<test user id>';

SELECT kind, tier, amount_cents, stripe_session_id, stripe_invoice_id, created_at
FROM public.purchases WHERE user_id = '<test user id>' ORDER BY created_at;

SELECT id, type, received_at FROM public.stripe_events ORDER BY received_at DESC LIMIT 10;
```

## The cases that actually matter

These are the ones that cost money when wrong. The eight above mostly prove
plumbing; these prove the design.

**A. Two slots, highest wins.** Buy the Desk **season pass** (#4), then the
Institutional **monthly** (#7). Expect `pass_tier=desk`,
`sub_tier=institutional`, `subscription_tier=institutional`,
`billing_mode=both`. Now cancel the subscription in the dashboard. Expect the
member to fall back to **desk** until February -- not to stay institutional.
That leak is the entire reason there are two slots.

**B. Idempotency.** `stripe events resend <evt_id>` for a completed checkout.
Expect no second `purchases` row and no change to the profile. Two guards
should fire: the `stripe_events` primary key and `last_stripe_session_id`.

**C. Renewal extends.** `stripe trigger invoice.payment_succeeded`. Expect
`sub_current_period_end` to move forward and a `purchases` row with
`kind='subscription_cycle'` carrying `stripe_invoice_id`.

**D. Failure does not extend.** `stripe trigger invoice.payment_failed`. Expect
`subscription_status='past_due'` and `sub_current_period_end` unchanged. Access
must survive -- `recompute_entitlement()` grants 3 days of grace so a dunning
retry does not lock out someone who has paid.

**E. Cancellation lapses, not revokes.** `customer.subscription.deleted` clears
the sub slot. Access should run to the end of the paid period, not vanish.

**F. Unknown price fails loudly.** POST `/api/stripe/checkout` with
`{"priceId":"price_nonexistent"}`. Expect **400**, no session, nothing granted.
The pre-v3 code fell back to the cheapest tier here, which silently sold
everyone the wrong product.

**G. Anti-downgrade.** Holding a live Private pass, try to buy the Portfolio.
Expect **409** with `heldTier`/`heldUntil` -- never take a second payment for
something already owned. Every one of those is a chargeback waiting.

**H. Refund revokes.** Refund a one-time charge in the dashboard. Expect
`charge.refunded` to clear the pass slot and leave any subscription alone.

## Gating, once a rung is held

The point of the ladder is what it unlocks. At each tier check `/vault/systems`,
`/vault/trends`, `/portfolio`, `/desk/nfl` and a game page. Retail sees free
rows only; Desk sees curated Vault rows **attached to a game** but not the
browsable library; Private sees the library; Institutional sees everything.

Locked rows must be **absent from the payload**, not hidden with CSS. View
source and confirm the text is not there.

---

## 8. Cleanup

```sql
DELETE FROM public.purchases WHERE user_id = '<test user id>';
DELETE FROM public.stripe_events
 WHERE received_at > '<when you started>'::timestamptz;

UPDATE public.profiles
   SET subscription_tier='retail', access_expires_at=NULL,
       pass_tier=NULL, pass_expires_at=NULL,
       sub_tier=NULL, sub_current_period_end=NULL,
       sub_cancel_at_period_end=false, sub_event_at=NULL,
       subscription_status=NULL, billing_mode='none',
       stripe_customer_id=NULL, stripe_subscription_id=NULL,
       last_stripe_session_id=NULL
 WHERE id = '<test user id>';
```

Confirm revenue is back where it started:

```sql
SELECT count(*), sum(amount_cents) FROM public.purchases;
```

## 9. Restore the live env

```bash
cp .env.local.live-backup .env.local
```

Non-negotiable. Leaving a test key in place means production checkout silently
stops taking money; leaving the live key in place with test price IDs means the
opposite. Verify `STRIPE_SECRET_KEY` starts `sk_live_` before you deploy.

Test-mode prices live in test mode only. Creating the live ones is a separate
`--write --live` run, and the eight Vercel vars must be the **live** IDs.
