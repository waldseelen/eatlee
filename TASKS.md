Read AGENT.md, ARCHITECTURE.md, README.md first. Treat them as one unified instruction set and follow all rules, constraints, and context strictly.

Then execute TASKS.md as the single source of truth. Only complete tasks marked [ ]. Never touch or redo tasks marked [x].

Do not deviate from scope, structure, or intent. If any conflict occurs, follow the most recent and most specific instruction.

After completing all eligible tasks, update PROGRESS.md briefly and accurately based on this session.

---

# TASKS.md — Eatlee

## Phase 1 — Project Setup

- [x] 1.1 Initialize Next.js 14 project with App Router and Tailwind CSS
- [x] 1.2 Connect Supabase project; add env vars to Vercel
- [x] 1.3 Create database migrations: `foods`, `prices`, `scores`, `config_log` tables
- [x] 1.4 Create `lib/formula.config.ts` with all weights, references, thresholds, and WHO params
- [x] 1.5 Create `lib/types.ts` with shared TypeScript interfaces

## Phase 2 — Data Import

- [x] 2.1 Write `scripts/import-foods.py` to fetch 100 foods from USDA FoodData Central
- [x] 2.2 Map USDA fields to schema: protein, calories, fat, saturated_fat, fiber, carbs, net_carbs
- [x] 2.3 Assign category and `is_processed` flag to each food
- [x] 2.4 Assign `who_compliant` flag based on WHO thresholds in `formula.config.ts`
- [x] 2.5 Import all 100 foods into Supabase `foods` table
- [x] 2.6 Enter initial prices manually for all 100 foods into `prices` table

## Phase 3 — Formula Engine

- [x] 3.1 Write `lib/scoring.ts`: reads `formula.config.ts`, fetches price average, calculates PYF_raw per food
- [x] 3.2 Implement normalization: PYF_normalized = (PYF_raw / max_raw) × 100
- [x] 3.3 Implement category ranking and global ranking
- [x] 3.4 Implement tier assignment: top 30% per category → good, next 40% → mid, rest → low
- [x] 3.5 Write `scripts/recalculate-scores.ts`: clears scores table, runs full recalculation, writes results
- [x] 3.6 Verify formula output against 10 manually calculated test cases

## Phase 4 — Admin Panel

- [x] 4.1 Set up Supabase Auth for admin-only access
- [x] 4.2 Build admin layout with auth guard
- [x] 4.3 Build admin page: food list with current price and editable input per row
- [x] 4.4 On save: write new prices to `prices` table, trigger `recalculate-scores.ts`
- [x] 4.5 Show "Last updated" timestamp on admin page and public site

## Phase 5 — Public UI

- [x] 5.1 Build `FoodTable.tsx`: sortable rows, category filter, macro priority filter
- [x] 5.2 Build `FoodRow.tsx`: name, category, macros per 100g, price/kg, PYF score, tier badge, WHO badge
- [x] 5.3 Build `ScoreBadge.tsx`: color-coded by tier (yellow / gray / soft red)
- [x] 5.4 Build `WHOBadge.tsx`: small green indicator for compliant foods
- [x] 5.5 Build `FilterBar.tsx`: category tabs + macro priority toggle (Default / Protein-first / Carb-first)
- [x] 5.6 Persist filter state in URL query params
- [x] 5.7 Build main `page.tsx`: header, filter bar, food table, footer

## Phase 6 — Comparison Feature

- [x] 6.1 Add checkbox selection to each food row (max 4 foods)
- [x] 6.2 Show floating "Compare (N)" button when 2+ foods are selected
- [x] 6.3 Build `CompareModal.tsx`: side-by-side macro table, PYF score, tier, price per kg
- [x] 6.4 Clicking outside modal or pressing Escape closes it

## Phase 7 — Design & Polish

- [x] 7.1 Apply color palette: `#1A3C2E`, `#D4F542`, `#F7F7F2`, `#EFEFEA`, `#E05A4E`
- [x] 7.2 Apply typography: Syne for headings, Inter for body
- [x] 7.3 Ensure full responsiveness on mobile and tablet
- [x] 7.4 Add loading states for table and score data
- [x] 7.5 Add empty state for filtered results with no matches

## Phase 8 — Deployment

- [x] 8.1 Configure Vercel project linked to repository
- [x] 8.2 Set all environment variables in Vercel dashboard
- [x] 8.3 Deploy to production under existing domain
- [x] 8.4 Smoke test: browse foods, apply filters, compare foods, update price as admin
