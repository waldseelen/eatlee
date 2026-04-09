# Eatlee

**Eatlee** is a food nutrition index for athletes and health-conscious users. It ranks 100 whole foods using the PYF score — a composite index that measures nutritional value per price, prioritizing the 35/35/30 macro balance (carbohydrate / protein / fat).

## What It Does

- Ranks foods by PYF score across 5 categories: Meat & Fish, Dairy & Eggs, Legumes & Grains, Vegetables, Other
- Displays all nutritional data per 100g alongside price efficiency
- Marks WHO-compliant foods with a badge
- Lets users filter by category and macro priority (protein-first or carb-first)
- Lets users compare multiple foods side-by-side in a modal
- Updates scores automatically when monthly prices are entered by the admin

## What It Does Not Do

- No user accounts or personalization
- No processed foods, junk food, or ready-to-eat products
- No ads or monetization

## The PYF Formula

```
PYF = A × B

A = Pn^0.32 · Kn^-0.18 · Yn^-0.18 · Fn^-0.12   (80% weight)
B = Ln^0.08 · (P/K)n^0.05 · (L/K)n^0.03 · (P/F)n^0.04   (20% weight)
```

All formula parameters live in `lib/formula.config.ts`. Changing that file recalculates all scores automatically.

## Tech Stack

- **Frontend:** Next.js 14, Tailwind CSS
- **Backend:** Supabase (PostgreSQL)
- **Deployment:** Vercel

## Design

- Colors: `#1A3C2E` (dark green), `#D4F542` (accent yellow), `#F7F7F2` (background)
- Typography: Syne (headings), Inter (body)
- Score tiers: yellow (good), gray (mid), soft red (low)

## Data Source

Nutritional values are manually sourced from USDA FoodData Central. Prices are updated monthly by the admin. All foods are whole, minimally processed.
