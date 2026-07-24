# Eatlee

**Eatlee** is a food nutrition index for athletes and health-conscious users. It ranks 100 whole foods using the PYF score — a composite index that measures nutritional value per price, prioritizing the 35/35/30 macro balance (carbohydrate / protein / fat).

## What It Does

- Ranks foods by PYF score across 5 categories: Meat & Fish, Dairy & Eggs, Legumes & Grains, Vegetables, Other
- Displays all nutritional data per 100g alongside price efficiency
- Marks WHO-compliant foods with a badge
- Lets users filter by category and macro priority (protein-first or carb-first)
- Lets users compare 2–4 foods side-by-side in a modal
- Recalculates all scores automatically when the admin enters new monthly prices

## What It Does Not Do

- No public user accounts or personalization (a single admin account exists only for price entry)
- No processed foods, junk food, or ready-to-eat products
- No ads or monetization

## The PYF Formula

```
PYF = A × B

A = Pn^0.32 · Kn^-0.18 · Yn^-0.18 · Fn^-0.12   (main driver)
B = Ln^0.08 · (P/K)n^0.05 · (L/K)n^0.03 · (P/F)n^0.04   (support terms)
```

All formula weights, references, the WHO thresholds, and the good-tier percentile live in `lib/formula.config.ts`. The pure calculation engine is `lib/scoring.ts`. Changing `formula.config.ts` and re-running the recalculation refreshes all scores.

> Note: one ranking threshold — the mid-tier 40% cutoff — is currently hardcoded in `lib/scoring.ts` (`assignRanksAndTiers`) rather than sourced from `formula.config.ts`.

## Tech Stack

- **Frontend:** Next.js 14 (App Router), React 18, Tailwind CSS
- **Data layer:** Firebase — Cloud Firestore (database) + Firebase Auth (admin sign-in)
- **Client SDK:** `firebase` (public reads, realtime listeners, auth)
- **Server/Admin SDK:** `firebase-admin` (API-route writes, ID-token verification)
- **Offline:** Firestore persistent local cache for reads; an IndexedDB queue (`idb-keyval`) for admin price writes made while offline
- **Deployment:** Vercel

## Data Flow

- The public page (`app/HomeClient.tsx` via `lib/data.ts`) is a client component that subscribes to the `foods`, `prices`, and `scores` Firestore collections with realtime `onSnapshot` listeners.
- The admin panel (`app/admin`) writes new price rows through `POST /api/admin/prices`, which uses the Admin SDK and then runs a full score recalculation (`lib/recalculate.ts`).

## Design

- Colors: `#1A3C2E` (dark green), `#D4F542` (accent yellow), `#F7F7F2` (cream background), `#EFEFEA` (mist), `#E05A4E` (coral) — defined in `tailwind.config.ts`
- Typography: Syne (headings), Inter (body)
- Score tiers: yellow (good), gray (mid), soft red (low)

## Data Source

Nutritional values are sourced from USDA FoodData Central via `scripts/import-foods.py`. Prices are updated monthly by the admin. All foods are whole, minimally processed.
