# EdTheStatMan.com

> **Live site → [edthestatman.com](https://edthestatman.com)**

A full-stack sports betting analytics platform built with **Next.js 14**, **Supabase**, and **Stripe**. Originally a static HTML/CSS/JS site, this project is a ground-up migration to a modern, production-grade web application with server-side rendering, a PostgreSQL database, role-based access control, payment processing, and a custom admin dashboard.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| Database + Auth | Supabase (PostgreSQL + Supabase Auth) |
| Payments | Stripe (one-time payments) |
| Rich Text Editor | Tiptap |
| Hosting | Vercel |
| Styling | Custom CSS (design system via CSS custom properties) |
| Fonts | Next.js Google Fonts — Outfit, Inter, JetBrains Mono |

---

## Features

### Member Access & Payments
- **Tiered content gating** — free, Basic (30-day), and Premium (365-day) access levels
- **One-time Stripe payments** (not subscriptions) with time-limited access via `access_expires_at`
- Stripe webhook processes `checkout.session.completed`, sets tier and expiry on the user profile
- Expired users are automatically downgraded to free tier without any cron job — access is evaluated at request time
- All rows always render; non-paying users see a paywall card rather than blank content

### Authentication
- Email + password signup and login via Supabase Auth
- Google OAuth sign-in
- Forgot password and reset password flow (email link → `/reset-password`)
- Session stored in httpOnly cookies and refreshed on every request via Next.js middleware
- Progressive hints: "Forgot password?" link appears after 2 failed login attempts

### Admin Dashboard (`/admin`)
- Role-based access controlled by an `is_admin` flag on the user profile (not a separate table)
- **Betting Systems & Trends** — full CRUD with inline row editing; edit form renders directly below the target row (no scroll-to-top), uses `router.refresh()` to avoid full-page reloads
- **Blog editor** — Tiptap rich text editor with access level control (free vs. members-only)
- **Home & Results page editors** — floating admin FAB that opens inline editable sections; content stored as JSONB in Supabase and merged with code-level defaults at render time
- **Analytics tab** — custom page view tracking (no third-party cookies) with a line chart breakdown by page
- **Bulk import** — JSON import endpoints for systems and trends

### Betting Content Pages
- Sport tabs filter (NFL, CFB, NBA, CBB) with pagination (20 rows per page)
- Rows show record (W/L/T), win%, units, description, team, and date
- Active/Free tags visible to all users; admin sees edit/delete controls inline
- Sort: systems by date ascending (soonest games first), trends by team then recency

### SEO
- Dynamic `sitemap.xml` (Next.js route handler) — includes all static routes + every published blog post
- Dynamic `robots.txt` — disallows `/admin`, `/account`, `/api`
- Auto-generated Open Graph image (Next.js `ImageResponse`, 1200×630) — branded, edge-rendered
- Full `og:*` and `twitter:*` metadata on every page
- Per-page canonical URLs via `alternates.canonical`
- Article JSON-LD schema on blog posts
- Organization + WebSite JSON-LD in root layout
- Auth pages marked `noindex`

### Blog
- Tiptap-powered rich text posts with free or members-only access levels
- `generateMetadata()` per post for SEO-correct titles, descriptions, and social cards
- Teaser + paywall gate for non-members viewing members-only posts

---

## Architecture

### App Router & Server Components
The project uses the Next.js 14 App Router throughout. Navigation, page data fetching, and auth checks all happen in Server Components so the browser never receives unbundled secrets. Client Components are used only where interactivity requires it (forms, tabs, the admin editor FAB).

### Three-Layer Supabase Client Pattern
A key architectural decision is using three separate Supabase clients in `lib/supabase/`:

```
client.ts   — Browser client (anon key, public RLS enforced)
server.ts   — Server client (reads/sets cookies, refreshes session on every request)
admin.ts    — Service role client (bypasses RLS, server-side only, never sent to browser)
```

This ensures that Row-Level Security policies are enforced at every public surface, while admin operations (webhook processing, bulk imports) use the service role safely server-side.

### Middleware
`middleware.ts` intercepts every request to:
- Redirect unauthenticated users away from `/admin` and `/account`
- Redirect authenticated users away from `/login` and `/signup`
- Refresh Supabase session cookies so they never silently expire mid-session

### Content Gating at Request Time
Access level is evaluated on each server render — no cached tiers, no client-side gate that can be bypassed. The server reads `subscription_tier` and `access_expires_at` from the `profiles` table, compares against `now()`, and decides which rows and post content to show before the HTML is generated.

### Stripe One-Time Payment Flow
```
User clicks Buy
  → POST /api/stripe/checkout
  → Creates/retrieves Stripe Customer
  → stripe.checkout.sessions.create({ mode: 'payment' })
  → User completes checkout on Stripe-hosted page
  → Stripe POSTs checkout.session.completed to /api/stripe/webhook
  → Webhook reads priceId from session metadata
  → Sets profiles.subscription_tier + access_expires_at (now + 30/365 days)
```
No subscriptions, no invoice events, no Customer Portal.

### Inline Admin Editing (UX Detail)
The admin edit form for betting rows renders **inline, directly below the clicked row** using `React.Fragment` wrapping in `baseRows.map()`. A `useRef` + `useEffect` scrolls the form into view smoothly. After save/delete, `router.refresh()` re-fetches server component data without resetting scroll position or React state — compared to the original `window.location.reload()` which reset everything.

---

## Database Schema

```sql
-- Profiles (extends Supabase auth.users)
profiles (id, email, full_name, avatar_url, subscription_tier,
          subscription_status, stripe_customer_id, access_expires_at,
          is_admin, created_at, updated_at)

-- Blog
posts (id, title, slug, content, excerpt, tag, access_level,
       published, published_at, author_id, created_at, updated_at)

-- Betting data (identical schema for both tables)
betting_systems (id, sport, description, line, season, type,
                 w, l, t, pct, units, date, team,
                 is_free, is_active, created_at, updated_at)
betting_trends  (id, sport, description, line, season, type,
                 w, l, t, pct, units, date, team,
                 is_free, is_active, created_at, updated_at)

-- Site content (admin-editable page sections)
site_content (key TEXT PRIMARY KEY, value JSONB, updated_at)

-- Analytics
page_views (id, path, referrer, created_at)
```

Enum types: `subscription_tier` (free/basic/premium), `subscription_status` (active/canceled/past_due/trialing/incomplete), `access_level` (free/members).

A Postgres trigger `handle_new_user()` automatically creates a `profiles` row for every new Supabase Auth signup.

---

## Project Structure

```
├── app/
│   ├── layout.tsx                  # Root layout — Nav, Footer, JSON-LD, fonts
│   ├── page.tsx                    # Home page
│   ├── betting-systems/page.tsx    # Systems page (SSR, force-dynamic)
│   ├── betting-trends/page.tsx     # Trends page (SSR, force-dynamic)
│   ├── results/page.tsx
│   ├── blog/
│   │   ├── page.tsx
│   │   └── [slug]/page.tsx         # Dynamic blog post (generateMetadata)
│   ├── pricing/page.tsx
│   ├── contact/page.tsx
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   ├── account/page.tsx            # Protected — redirects if unauthenticated
│   ├── admin/                      # Protected — requires is_admin flag
│   ├── api/
│   │   ├── admin/
│   │   │   ├── systems/            # CRUD + bulk import
│   │   │   ├── trends/             # CRUD + bulk import
│   │   │   ├── posts/              # CRUD
│   │   │   ├── content/            # Site content edits
│   │   │   └── analytics/          # Page view data
│   │   ├── stripe/
│   │   │   ├── checkout/           # Initiate payment
│   │   │   └── webhook/            # Process completed payments
│   │   └── track/                  # Page view tracking
│   ├── opengraph-image.tsx         # Edge-rendered branded OG image
│   ├── sitemap.ts                  # Dynamic sitemap (all pages + blog posts)
│   └── robots.ts                   # Dynamic robots.txt
│
├── components/                     # 36 React components
│   ├── Navigation.tsx
│   ├── SportTabsSystem.tsx         # Betting systems UI with inline admin editing
│   ├── TrendsFilter.tsx            # Betting trends UI with inline admin editing
│   ├── AdminDashboard.tsx
│   ├── PostEditorClient.tsx        # Tiptap blog editor
│   ├── HomeEditor.tsx              # Admin FAB for home page sections
│   ├── CheckoutButton.tsx
│   └── PageViewTracker.tsx         # Lightweight analytics (no third-party)
│
├── hooks/
│   ├── useCounter.ts               # Animated number counters
│   └── useScrollAnimation.ts       # Scroll-triggered reveal animations
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Browser client
│   │   ├── server.ts               # Server client (cookie-aware)
│   │   └── admin.ts                # Service role (bypasses RLS)
│   ├── stripe.ts                   # Singleton Stripe client + priceTier() helper
│   └── site-content.ts             # Default values for editable content sections
│
├── supabase/
│   ├── schema.sql
│   ├── betting_tables.sql
│   └── migrations/
│
├── scripts/
│   ├── seed-data.mjs               # Seed from Excel
│   └── import-wp-users.mjs         # Migrate WordPress users to Supabase
│
└── middleware.ts                   # Auth protection + session refresh
```

---

## Key Design Decisions & Trade-offs

**Why one-time payments instead of subscriptions?**
The client model is time-limited access (30 or 365 days) rather than recurring billing. Stripe's `payment` mode is simpler to operate, requires no Customer Portal, and avoids Stripe subscription event complexity. Access expiry is stored as a single `timestamptz` column and evaluated at request time.

**Why custom CSS instead of Tailwind?**
The project started as a static HTML/CSS site with an established visual identity. Migrating to a utility-first framework would have required redesigning the entire component tree. The CSS custom properties system (defined in `globals.css`) provides the same maintainability benefits — global color, spacing, and typography tokens — with zero build overhead.

**Why no client-side data fetching for betting rows?**
Betting content is fetched server-side on every request (`force-dynamic`) so access control is always enforced on the server. There's no window where a free-tier user could inspect a pending API call and extract members-only data.

**Why three Supabase clients?**
Using the service role key in the browser is a critical security vulnerability (it bypasses RLS). Keeping three explicitly typed clients forces a review of which client to reach for in any given context, making accidental privilege escalation obvious at the import level.

---

## WordPress Migration

The `scripts/import-wp-users.mjs` script handles migrating ~197 legacy WordPress users to Supabase:

- **`$wp$2y$...` hashes** (WordPress 6.8+ bcrypt) — strips the `$wp$` prefix, imports the bcrypt hash directly via `supabase.auth.admin.createUser({ password_hash })`. Users can log in immediately with their existing password.
- **`$P$...` hashes** (phpass, MD5-based) — Supabase's bcrypt engine can't verify these. Users are imported with `email_confirm: true` and a password reset email is sent so they can set a new password without re-registering.

---

*Built and maintained by [EdTheStatMan](https://edthestatman.com)*
