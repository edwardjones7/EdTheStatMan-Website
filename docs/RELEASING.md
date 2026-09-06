# Releasing

How this repo numbers what it ships. Read `CHANGELOG.md` for what each release
actually contained.

The rule this exists to enforce: **`main` is production.** Vercel deploys every
push to `main`, so the deploy already happened by the time you think about a
version. A tag does not cause a release; it *names* the commit that is live, so
that "the ticker broke after Tuesday" becomes a diff instead of an archaeology
session.

---

## 1. The number

`MAJOR.MINOR.PATCH`, standard semver, read from the **member's** side rather than
from the code's. The question is always "what does this change for someone who
pays us", not "how many files moved".

| Bump | Means | Examples from real history |
|---|---|---|
| **MAJOR** | The product a member bought is a different shape. New or renamed rungs, a change to what a tier includes, prices changing, the URL structure moving, a migration that changes what an existing row *means*. | 3.0.0: four tiers became the five-rung ladder, `/pricing` became `/win`, `/betting-systems` became `/vault/systems`, every member's `subscription_tier` was rewritten. |
| **MINOR** | Something new that nobody has to relearn. A new surface, a new sport, a new alert channel, an admin tool. Existing rungs still mean what they meant. | College football on the Research Desk. Discord role sync. Vault row codes and ID search. |
| **PATCH** | It was supposed to work like this already. Bug fixes, copy, CSS, performance, anything invisible on a feature list. | The empty systems picker. The iOS ticker font. The mobile Vault layout. |

Two judgement calls worth writing down:

- **A migration is not automatically major.** `vault_01_row_codes.sql` only *added*
  a column, so it went out inside a minor. `tier_ladder_05_migrate_users.sql`
  rewrote what every existing row meant, so it was major.
- **Copy that states the offer is not patch-only.** If the price on the page
  changes, that is a major, even though the diff is one string. The number
  tracks the promise, not the character count.

## 2. When to cut one

- **MAJOR** — when it is done and verified in production, not when it merges.
  These are rare; 3.0.0 is the first.
- **MINOR** — when a feature is finished and live. One tag per feature is fine;
  do not batch two unrelated features into one number just to save a tag.
- **PATCH** — batch them. Tag at the end of a session that only fixed things,
  or at the end of the week. Do not tag every commit.

If a week goes by with nothing but fixes, that week is one patch tag. If a week
goes by with nothing worth telling a member, it gets no tag at all. An untagged
commit is not a mistake.

## 3. Cutting one

```bash
# 1. the number, in the one place it lives
#    (npm version writes package.json AND makes the commit and the tag)
npm version minor -m "Release v%s — <the one-line reason>"

# 2. write the entry BEFORE pushing, so the tag and the changelog agree
$EDITOR CHANGELOG.md
git add CHANGELOG.md && git commit --amend --no-edit

# 3. push the branch and the tag together, or the tag is only on this laptop
git push origin main --follow-tags
```

`npm version` refuses to run on a dirty tree, which is the behaviour you want:
it means the tag can only ever point at a commit that is actually the release.

Check what is live: the admin dashboard footer prints the version it was built
from. If that number is behind the tag you just pushed, Vercel has not finished
deploying (or the build failed) — the tag is not the deploy.

## 4. This repo works from two laptops

Tags do not travel with `git push` on their own. `--follow-tags` above is not
optional, and on the *other* machine `git pull` alone will not fetch them
either — use `git fetch --tags`. A tag that exists on one laptop and not the
other is worse than no tag, because `git describe` will confidently give two
different answers for the same commit.

## 5. History before 3.0.0

Untagged. The repo ran for months with `package.json` frozen at `1.0.0` and no
releases, so there is nothing to reconstruct: the changelog starts at 3.0.0 and
everything earlier is `git log`.

The number is 3 rather than 2 because the ladder work had already been called
"v3" everywhere it was written down — the `v3-tier-ladder` branch, the
`tier_ladder_*` migrations, the vault notes — for a month before it shipped.
Renumbering it to 2.0.0 to satisfy `package.json`, a file no member has ever
seen, would have made every one of those references wrong.
