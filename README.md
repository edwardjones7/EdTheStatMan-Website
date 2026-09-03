# EdTheStatMan.com

> **Live site → [edthestatman.com](https://edthestatman.com)**

A sports betting membership site: tier-gated access to a predictive model's systems library, weekly curated research, and graded picks. Next.js 14 App Router, Supabase, Stripe, deployed on Vercel.

**Full technical reference: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)** — routes, schema, entitlement model, Stripe flow, env vars, operations, and known gaps. Start there.

---

## Quick start

```bash
npm install
npm run dev          # → http://localhost:3000
```

`npm run build`, `npm run start` and `npm run lint` are the only other scripts.

> [!WARNING]
> `.env.local` holds **live production credentials** — the real Supabase project, a live Stripe key, and the real Resend key. There is no sandbox. Anything run locally writes to the production database and sends real email to real members. Treat every local script run as a production change.

### Environment

There is no `.env.example`. The complete, annotated list of every required variable is in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#12-environment-variables). At minimum you need the three Supabase keys, `NEXT_PUBLIC_SITE_URL`, the Stripe secret and webhook secret, and the Stripe price IDs.

Never mark a `NEXT_PUBLIC_*` variable as "Sensitive" in Vercel — it is then not exposed at build time and Next silently inlines `undefined`.

### Database

There is no migration runner. Files in `supabase/` are applied by hand in the Supabase SQL editor, in the order each file's header specifies. Read the header before pasting: `betting_tables.sql` drops its tables first, and `add_elite_tier.sql` must run alone.

---

## Layout

```
app/          routes: pages + API handlers (App Router)
components/   ~49 React components
lib/          shared logic: access, offer, stripe, gate, teaser, nfl,
              analytics, notify/, supabase/
hooks/        useCounter, useScrollAnimation
supabase/     schema.sql, betting_tables.sql, migrations/
scripts/      one-off .mjs jobs, all service-role, run with node directly
docs/         ARCHITECTURE.md
```

---

## Why the code looks like this

**Custom CSS, not Tailwind.** The project started as a static site with an established visual identity. The CSS custom properties system in `globals.css` gives the same global tokens for color, spacing and typography with zero build overhead, without redesigning the entire component tree.

**No client-side fetching for gated rows.** Content is fetched server-side on every request (`force-dynamic`) so access control is always enforced on the server. Locked rows are dropped or redacted before render — there is no window in which a free user could inspect a pending API call and extract members-only data.

**Three separate Supabase clients.** Using the service role key in the browser bypasses RLS entirely. Three explicitly typed clients force a decision about which one to reach for, making accidental privilege escalation obvious at the import line.

**Inline admin editing.** Admin forms render directly below the clicked row and save with `router.refresh()`, which re-fetches server component data without resetting scroll position or React state.

---

## WordPress migration

`scripts/import-wp-users.mjs` migrates ~197 legacy WordPress users to Supabase:

- **`$wp$2y$...`** (WordPress 6.8+ bcrypt) — strips the prefix and imports the hash via `auth.admin.createUser({ password_hash })`. Users log in with their existing password and notice nothing.
- **`$P$...`** (phpass, MD5-based) — Supabase cannot verify these. Users are imported with `email_confirm: true` and sent a reset email.
