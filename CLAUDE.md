# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project identity

Eatlee is a Next.js 14 (App Router) web app that ranks ~100 whole foods for athletes and health-conscious users by a composite "PYF" nutrition-per-price score. The one canonical data-layer fact: it runs entirely on **Firebase** — **Cloud Firestore** for data and **Firebase Auth** for the single admin account. There is no Supabase and no SQL despite what older docs may imply.

## Commands

```bash
npm run dev                # Start the Next.js dev server
npm run build              # Production build (correctness gate)
npm run start              # Run the production build
npm run lint               # next lint (correctness gate)
npm run test               # node --test on lib/scoring.test.ts + lib/food-table.test.ts (gate)
npm run smoke              # Playwright end-to-end smoke test (browse/filter/compare/admin save)
npm run scores:recalculate # Recompute all scores from Firestore (run after formula.config changes)
npm run foods:import       # python scripts/import-foods.py — USDA fetch -> Firestore
npm run admin:create       # Create/update the Firebase admin user from ADMIN_EMAIL/ADMIN_PASSWORD
npm run analyze            # Production build with @next/bundle-analyzer
```

Correctness gates before shipping meaningful changes: `npm run lint`, `npm run test`,
`npm run build`, then `npm run smoke` (needs Firebase env + admin credentials; use
`SMOKE_BASE_URL=<url> npm run smoke` against a deployed instance). "Verified" means lint
and the unit tests pass and the build succeeds; the smoke test is the integration gate.

## Architecture

### Data flow

- **Public reads are client-side and realtime.** `app/page.tsx` is a thin server shell
  rendering `app/HomeClient.tsx`, which calls `useEatleeData()` in `lib/data.ts`. That hook
  opens `onSnapshot` listeners on the `foods`, `prices`, and `scores` Firestore collections
  and merges them in memory (latest price + average price + score per food).
- **Admin writes are server-side.** `app/admin/AdminPageClient.tsx` sends changed prices
  with a Firebase ID token to `POST /api/admin/prices`. `lib/api-auth.ts` verifies the token
  (Admin SDK) and checks the email allowlist, then the route appends new `prices` documents
  and runs `recalculateAllScores()` (`lib/recalculate.ts`), which rewrites `scores` and
  appends a `config_log` entry.
- **Scoring is pure.** `lib/scoring.ts` does math only (no I/O); `lib/recalculate.ts` is the
  I/O layer that feeds it Firestore data and persists results.

### Directory layout

```
app/
  page.tsx, HomeClient.tsx, layout.tsx, loading.tsx
  admin/       page.tsx, layout.tsx, AdminLayoutClient.tsx, AdminPageClient.tsx
  api/         admin/prices/route.ts, recalculate/route.ts
components/     FoodTable.tsx, FoodRow.tsx, CompareModal.tsx, FilterBar.tsx,
               ScoreBadge.tsx, WHOBadge.tsx
lib/           formula.config.ts, scoring.ts, recalculate.ts, data.ts, food-table.ts,
               firebase.ts, firebase-admin.ts, auth.ts, api-auth.ts, offlineSync.ts, types.ts
scripts/       import-foods.py, migrate-to-firebase.ts, recalculate-scores.ts,
               create-admin.ts, smoke-test.ts, load-env.ts, data/
```

Firestore collections: `foods`, `prices` (append-only), `scores` (doc id == food_id, wiped
and rewritten each recalculation), `config_log`. Full field shapes are in ARCHITECTURE.md and
`lib/types.ts`.

### PYF scoring / formula pipeline

`lib/formula.config.ts` exports `FORMULA_CONFIG` (weights, references, `goodTierPercentile`,
WHO thresholds). `lib/scoring.ts` reads it to compute `PYF = A × B`, normalizes to 0–100
against the max raw score, then assigns per-category ranks and tiers (top 30% "good", next
40% "mid", rest "low") plus a global rank. WHO compliance is derived from `saturated_fat`,
`calories`, `fiber`, and `sodium` against the WHO thresholds and re-stamped onto each food on
every recalculation.

## Absolute rules — do not break these

1. **Firebase is the only data layer.** Firestore for data, Firebase Auth for the admin
   account. Do not add Supabase, Prisma, or SQL. Client access goes through `lib/firebase.ts`;
   server/admin access through `lib/firebase-admin.ts`.
2. **Formula parameters live in `lib/formula.config.ts`.** Weights, reference values, the
   good-tier percentile, and WHO thresholds belong there — not inline in components or
   scoring code. (Known exception to be aware of: the mid-tier `0.4` split is currently
   hardcoded in `scoring.ts`'s `assignRanksAndTiers`. If you touch tiering, prefer moving it
   into the config rather than adding more hardcoded thresholds.)
3. **`lib/scoring.ts` stays pure.** No Firestore, network, or env access in the scoring
   engine — all I/O lives in `lib/recalculate.ts` and the API routes. This keeps
   `lib/scoring.test.ts` deterministic.
4. **Admin write authorization is the server email allowlist.** Every mutating API route must
   call `requireAuthenticatedUser` (`lib/api-auth.ts`), which verifies the Firebase ID token
   and matches the email against `ADMIN_EMAIL` / `NEXT_PUBLIC_ADMIN_EMAIL`. Do not rely on the
   client `isAdmin()` claim check as a security boundary — that custom claim is never set.
5. **Prices are append-only; scores are derived.** Never mutate or delete historical `prices`
   rows to "edit" a price — write a new row. Never hand-edit the `scores` collection; it is
   fully regenerated by `recalculateAllScores()`. Any price change must trigger a
   recalculation.
6. **Admin UI must stay SSR-safe.** `app/admin/page.tsx` and `layout.tsx` import their clients
   with `dynamic(..., { ssr: false })` because they touch Firebase Auth/`window`. Keep that
   pattern; do not render admin client components on the server.
7. **Env vars are names-only in code and docs.** Load them via `process.env` (scripts use
   `scripts/load-env.ts`); never hardcode or commit real Firebase/USDA/admin secret values.

## Doc trust note

README.md and ARCHITECTURE.md were corrected to match the actual Firebase/Firestore code
(they previously described a Supabase/PostgreSQL stack) — trust them. **Do not trust `AGENT.md`
on the data layer**: it still references Supabase, `supabase/migrations`, and a non-existent
`npm run db:push`; it is stale and out of scope of this correction. Likewise,
`scripts/import-foods.py`'s docstring mentions Supabase, but its code writes to Firestore —
trust the code. `PROGRESS.md` / `TASKS.md` are historical tracking files, not architecture.
