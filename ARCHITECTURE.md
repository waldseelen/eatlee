# ARCHITECTURE.md — Eatlee

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (admin only) |
| Deployment | Vercel |
| Data Source | USDA FoodData Central (manual import) |

## Repository Structure

```
eatlee/
├── app/
│   ├── page.tsx                  # Main food table page
│   ├── admin/
│   │   ├── page.tsx              # Admin price entry panel
│   │   └── layout.tsx            # Admin auth guard
│   └── layout.tsx                # Root layout
├── components/
│   ├── FoodTable.tsx             # Main sortable/filterable table
│   ├── FoodRow.tsx               # Single food row
│   ├── CompareModal.tsx          # Multi-food comparison modal
│   ├── FilterBar.tsx             # Category + macro filter controls
│   ├── ScoreBadge.tsx            # Color-coded PYF score display
│   └── WHOBadge.tsx              # WHO compliance indicator
├── lib/
│   ├── formula.config.ts         # SINGLE SOURCE OF TRUTH for all formula params
│   ├── scoring.ts                # PYF calculation engine (reads formula.config.ts)
│   ├── supabase.ts               # Supabase client
│   └── types.ts                  # Shared TypeScript types
├── scripts/
│   ├── import-foods.py           # USDA data fetch and Supabase import
│   └── recalculate-scores.ts     # Triggered after price update or config change
└── supabase/
    └── migrations/               # Database schema migrations
```

## Database Schema

### `foods`
```sql
id            uuid PRIMARY KEY
name          text NOT NULL
category      text NOT NULL  -- 'meat_fish' | 'dairy_eggs' | 'legumes_grains' | 'vegetables' | 'other'
protein       numeric        -- per 100g
calories      numeric        -- per 100g
fat           numeric        -- per 100g (total fat)
saturated_fat numeric        -- per 100g
fiber         numeric        -- per 100g
carbs         numeric        -- per 100g (total)
net_carbs     numeric        -- carbs - fiber
is_processed  boolean DEFAULT false
who_compliant boolean DEFAULT false
usda_fdc_id   text           -- reference to USDA source
created_at    timestamptz
```

### `prices`
```sql
id            uuid PRIMARY KEY
food_id       uuid REFERENCES foods(id)
price_per_kg  numeric NOT NULL
updated_at    timestamptz DEFAULT now()
```

### `scores`
```sql
id              uuid PRIMARY KEY
food_id         uuid REFERENCES foods(id)
pyf_raw         numeric        -- raw geometric output
pyf_normalized  numeric        -- 0–100 scale
category_rank   integer        -- rank within category
global_rank     integer        -- rank across all foods
tier            text           -- 'good' | 'mid' | 'low'
calculated_at   timestamptz
```

### `config_log`
```sql
id            uuid PRIMARY KEY
changed_at    timestamptz
changed_by    text
snapshot      jsonb          -- full formula.config.ts snapshot at time of change
```

## Formula Config File

`lib/formula.config.ts` is the only place formula parameters live.

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
    goodTierPercentile: 0.30,  // top 30% = good
  },
  who: {
    maxSaturatedFatPct: 10,    // % of total calories
    minFiberPer100g:    3,
    maxSodiumPer100g:   400,
  }
}
```

Any change to this file must be followed by running `recalculate-scores.ts`.

## Score Calculation Flow

```
formula.config.ts
      ↓
scoring.ts  (reads config, fetches price avg from prices table)
      ↓
PYF_raw = A × B
  A = Pn^0.32 · Kn^-0.18 · Yn^-0.18 · Fn^-0.12
  B = Ln^0.08 · (P/K)n^0.05 · (L/K)n^0.03 · (P/F)n^0.04
      ↓
PYF_normalized = (PYF_raw / max_raw) × 100
      ↓
category_rank + global_rank assigned
      ↓
tier = top 30% per category → 'good', next 40% → 'mid', rest → 'low'
      ↓
scores table updated
```

## Admin Flow

1. Admin logs in via Supabase Auth
2. Admin panel shows all 100 foods with current price
3. Admin updates price fields → saves to `prices` table
4. Save triggers `recalculate-scores.ts` → all scores refreshed
5. "Last updated" timestamp shown on public site

## Comparison Feature

- User selects 2+ foods via checkbox in the table
- "Compare" button opens `CompareModal.tsx`
- Modal shows side-by-side: all macros + PYF score + tier + price
- No separate page — modal overlay only
- The architecture source-of-truth for comparison is the modal implementation in `components/CompareModal.tsx`

## Filter System

- Category filter: All / Meat & Fish / Dairy & Eggs / Legumes & Grains / Vegetables
- Macro priority filter: Default / Protein-first / Carb-first
- Both filters work together; state lives in URL query params for shareability

## Deployment

- Vercel: auto-deploy on push to `main`
- Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Public reads use the public Supabase client; admin and server-side recalculation flows use authenticated or service-role access as needed
- No separate staging environment at launch
