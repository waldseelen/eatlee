# ARCHITECTURE.md — Eatlee

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18 |
| Styling | Tailwind CSS |
| Database | Cloud Firestore (Firebase) |
| Auth | Firebase Auth — single admin account, gated by an email allowlist |
| Client SDK | `firebase` (realtime reads, auth) |
| Server SDK | `firebase-admin` (API-route writes, ID-token verification) |
| Deployment | Vercel |
| Data Source | USDA FoodData Central (import script) |

## Repository Structure

```
eatlee/
├── app/
│   ├── page.tsx                  # Server shell that renders HomeClient
│   ├── HomeClient.tsx            # Public client page (realtime Firestore reads)
│   ├── loading.tsx              # Root loading UI
│   ├── layout.tsx               # Root layout (fonts, metadata)
│   ├── admin/
│   │   ├── page.tsx             # Server shell -> AdminPageClient (ssr:false)
│   │   ├── layout.tsx           # Server shell -> AdminLayoutClient (ssr:false)
│   │   ├── AdminLayoutClient.tsx # Firebase Auth guard + login form
│   │   └── AdminPageClient.tsx  # Monthly price entry table
│   └── api/
│       ├── admin/prices/route.ts # POST: save price rows, then recalculate
│       └── recalculate/route.ts  # POST: recalculate scores only
├── components/
│   ├── FoodTable.tsx             # Main sortable/filterable table (max 4 compare)
│   ├── FoodRow.tsx               # Single food row
│   ├── CompareModal.tsx          # Multi-food comparison modal
│   ├── FilterBar.tsx             # Category + macro filter controls (URL params)
│   ├── ScoreBadge.tsx            # Color-coded PYF score display
│   └── WHOBadge.tsx              # WHO compliance indicator
├── lib/
│   ├── formula.config.ts         # Formula params: weights, references, WHO, good-tier %
│   ├── scoring.ts                # Pure PYF calculation + ranking/tier engine
│   ├── recalculate.ts            # Reads Firestore, writes scores/config_log (Admin SDK)
│   ├── data.ts                   # useEatleeData() realtime listeners for the public page
│   ├── food-table.ts             # Sorting/filtering helpers for the table
│   ├── firebase.ts               # Client Firebase app, Auth, Firestore (persistent cache)
│   ├── firebase-admin.ts         # Admin SDK Firestore + Auth accessors
│   ├── auth.ts                   # Client sign-in/out, session, isAdmin() UI gate
│   ├── api-auth.ts               # Server ID-token verification + email allowlist
│   ├── offlineSync.ts            # IndexedDB queue for offline admin price writes
│   └── types.ts                  # Shared TypeScript types
└── scripts/
    ├── import-foods.py           # USDA fetch -> Firestore foods/prices import
    ├── migrate-to-firebase.ts    # One-time Supabase/local -> Firestore migration
    ├── recalculate-scores.ts     # CLI wrapper around recalculateAllScores()
    ├── create-admin.ts           # Create/update the Firebase admin user
    ├── smoke-test.ts             # Playwright smoke test (local or remote)
    ├── load-env.ts              # Loads .env / .env.local for TS scripts
    └── data/                    # Manifest CSVs + dry-run/seed data
```

> There is no `supabase/` directory and no SQL migrations. An earlier version of this
> project used Supabase; it has been migrated to Firebase. `scripts/migrate-to-firebase.ts`
> remains as the migration path (it can optionally pull from a legacy Supabase REST
> endpoint, otherwise it seeds from local files).

## Data Model (Firestore Collections)

The database is Firestore. Documents are plain JSON; there is no SQL schema. Field
shapes come from `lib/types.ts`, `lib/recalculate.ts`, and the import/route writers.

### `foods` (auto-generated doc id)
```
name          string   -- e.g. "Chicken breast"
category      string   -- 'meat_fish' | 'dairy_eggs' | 'legumes_grains' | 'vegetables' | 'other'
protein       number   -- g per 100g
calories      number   -- kcal per 100g
fat           number   -- g per 100g (total fat)
saturated_fat number   -- g per 100g
fiber         number   -- g per 100g
carbs         number   -- g per 100g (total)
net_carbs     number   -- carbs - fiber (floored at 0)
sodium        number   -- mg per 100g (used for WHO compliance)
is_processed  boolean
who_compliant boolean  -- recomputed on every recalculation
usda_fdc_id   string | null   -- reference to USDA source
created_at    string   -- ISO timestamp (set by migration/seed)
```

### `prices` (auto-generated doc id, append-only)
```
food_id       string   -- foods doc id
price_per_kg  number
updated_at    string   -- ISO timestamp
```
Each save writes a **new** price document; the current price is the latest by
`updated_at`. Historical rows are kept, not overwritten.

### `scores` (doc id == food_id)
```
food_id        string
pyf_raw        number   -- raw geometric output
pyf_normalized number   -- 0–100 scale
category_rank  integer  -- rank within category
global_rank    integer  -- rank across all foods
tier           string   -- 'good' | 'mid' | 'low'
calculated_at  string   -- ISO timestamp
```
The whole `scores` collection is deleted and rewritten on every recalculation.

### `config_log` (auto-generated doc id)
```
changed_at    string   -- ISO timestamp
changed_by    string   -- e.g. "recalculate-scores"
snapshot      object   -- full FORMULA_CONFIG snapshot at recalculation time
```

## Formula Config File

`lib/formula.config.ts` holds the formula weights, reference values, the good-tier
percentile, and the WHO thresholds.

```typescript
export const FORMULA_CONFIG = {
  weights: {
    protein:     0.32,  // a — main driver
    calories:   -0.18,  // b — negative
    fat:        -0.18,  // c — negative
    price:      -0.12,  // d — negative
    fiber:       0.08,  // e — support
    proteinPerCalorie: 0.05,  // f
    fiberPerCalorie:   0.03,  // g
    proteinPerPrice:   0.04,  // h
  },
  references: {
    protein:   20,    // g per 100g
    calories:  300,   // kcal per 100g
    fat:       15,    // g per 100g
    fiber:     5,     // g per 100g
    carbs:     30,    // g per 100g
  },
  thresholds: {
    goodTierPercentile: 0.30,  // top 30% per category = good
  },
  who: {
    maxSaturatedFatPct: 10,    // % of total calories
    minFiberPer100g:    3,
    maxSodiumPer100g:   400,
  }
} as const
```

Any change to this file must be followed by a recalculation (`npm run scores:recalculate`,
or a price save through the admin panel, which recalculates automatically).

> Caveat: the mid-tier split (`0.4`) is currently hardcoded in `scoring.ts`
> (`assignRanksAndTiers`), not read from `formula.config.ts`. Only the good-tier
> percentile is config-driven.

## Score Calculation Flow

`lib/scoring.ts` is a pure engine (no I/O). `lib/recalculate.ts` supplies it with
Firestore data and persists the results.

```
formula.config.ts
      ↓
scoring.ts  (buildRankedScores: normalizes inputs, averages prices from the prices collection)
      ↓
PYF_raw = A × B
  A = Pn^0.32 · Kn^-0.18 · Yn^-0.18 · Fn^-0.12
  B = Ln^0.08 · (P/K)n^0.05 · (L/K)n^0.03 · (P/F)n^0.04
      ↓
PYF_normalized = (PYF_raw / max_raw) × 100
      ↓
category_rank + global_rank assigned (by normalized score, descending)
      ↓
tier per category: top 30% → 'good', next 40% → 'mid', rest → 'low'
      ↓
scores collection wiped and rewritten; foods.who_compliant refreshed; config_log appended
```

Foods with no positive average price are skipped and excluded from the scores collection.

## Admin Flow

1. Admin signs in via Firebase Auth (`AdminLayoutClient` login form).
2. Admin panel (`AdminPageClient`) loads all foods with their latest price.
3. Admin edits price fields and clicks **Save all**.
4. The client attaches the Firebase ID token as a `Bearer` header and calls
   `POST /api/admin/prices`.
5. `lib/api-auth.ts` (`requireAuthenticatedUser`) verifies the token with the Admin SDK
   and checks the email against the `ADMIN_EMAIL` / `NEXT_PUBLIC_ADMIN_EMAIL` allowlist.
6. New price rows are written to `prices`, then `recalculateAllScores()` runs.
7. If the browser is offline at save time, changes are queued in IndexedDB
   (`lib/offlineSync.ts`) and pushed straight to Firestore when connectivity returns
   (this offline path bypasses the API route and its recalculation).
8. The public site reflects the change through its realtime listeners and shows a
   "Last updated" timestamp.

> Note: the enforced security boundary is the server-side email allowlist in
> `api-auth.ts`. The client-side `isAdmin()` in `auth.ts` checks a `claims.admin`
> custom claim, but `create-admin.ts` does not set that claim — treat the allowlist as
> the authoritative gate.

## Comparison Feature

- User selects 2–4 foods via checkbox in the table (`MAX_COMPARE = 4`).
- "Compare" button opens `components/CompareModal.tsx`.
- Modal shows side-by-side: all macros + price + PYF score + WHO badge.
- No separate page — modal overlay only.
- The source-of-truth for comparison is `components/CompareModal.tsx`.

## Filter System

- Category filter: All / Meat & Fish / Dairy & Eggs / Legumes & Grains / Vegetables / Other
- Macro priority filter: Default / Protein-first / Carb-first
- Both filters work together; state lives in URL query params (`category`, `priority`)
  via `components/FilterBar.tsx` for shareability.

## Deployment

- Vercel (`vercel.json` sets the Next.js framework), auto-deploy on push to `main`.
- Environment variables (see `.env.example`):
  - Client: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
    `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`,
    `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`
  - Server/Admin SDK: `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
  - Admin allowlist: `ADMIN_EMAIL`, `NEXT_PUBLIC_ADMIN_EMAIL` (and `ADMIN_PASSWORD` for
    `create-admin.ts` / smoke tests)
  - Import: `USDA_API_KEY`
- Public reads use the client Firebase SDK; admin writes and server-side recalculation use
  the Admin SDK with service-account credentials.
- No separate staging environment at launch.
