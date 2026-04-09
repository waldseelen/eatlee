# AGENT.md — Eatlee

## Project Identity

Eatlee is a statistical nutrition reference site for athletes and health-conscious users. It ranks foods using the PYF (Protein-Yield-Fiber) index — a composite score that balances nutritional value against price. The goal is to help users make smarter food choices based on real data, not marketing.

## Agent Attitude

- All decisions are grounded in this documentation set. Do not improvise, assume, or infer outside of it.
- Do not add features outside scope. If a new feature is needed, update the documentation first.
- If a conflict exists between files, follow the most recent and most specific instruction.
- Read architecture and task context before writing any code.
- Update PROGRESS.md accurately at the end of every session.
- Never redo tasks marked [x]. Never skip tasks marked [ ].

## Environment & Secret Handling

- Local development secrets live in `.env.local` and must never be committed.
- Expected environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `USDA_API_KEY`
  - `NEXT_PUBLIC_ADMIN_EMAIL`
  - `ADMIN_EMAIL`
  - `ADMIN_PASSWORD`
- TypeScript helper scripts now load `.env` / `.env.local` automatically through `scripts/load-env.ts`.
  - This applies to:
    - `scripts/create-admin.ts`
    - `scripts/recalculate-scores.ts`
    - `scripts/smoke-test.ts`
- Python scripts still depend on shell environment being available when run.
- Never print, hardcode, or commit real secret values.
- When documenting env setup, reference variable names only, never actual values.

## Operational References

### Supabase
- Current linked Supabase project ref: `hzdrvruefghfnjjrkevq`
- Supabase config lives in `supabase/config.toml`.
- Schema source of truth lives in `supabase/migrations/001_create_tables.sql`.
- Push schema changes with:
  - `npm run db:push`
- If price data changes or `lib/formula.config.ts` changes, run:
  - `npm run scores:recalculate`
- Admin user maintenance command:
  - `npm run admin:create`
- Do not create a new Supabase project unless documentation explicitly changes.

### Vercel
- Current linked Vercel project: `eatlee`
- Current Vercel scope: `waldseelens-projects`
- Vercel project metadata is stored in `.vercel/project.json`.
- Vercel config file: `vercel.json`
- Current production alias:
  - `https://eatlee.vercel.app`
- Current production deployment URL may change per deploy, but `eatlee.vercel.app` is the stable production alias.
- Intended existing-domain target:
  - `eatlee.bugraakin.com`
- If custom domain work continues, current required DNS record is:
  - `A eatlee.bugraakin.com 76.76.21.21`
- Deploy production with:
  - `vercel --prod --yes --scope waldseelens-projects`
- Inspect deployment with:
  - `vercel inspect eatlee.vercel.app --scope waldseelens-projects`
- Do not recreate or relink the Vercel project unless necessary.

## Agent Workflow Notes

- Always read `AGENT.md`, `ARCHITECTURE.md`, `README.md`, `PROGRESS.md`, and `TASKS.md` before task execution when the user requests task-driven work.
- Treat `TASKS.md` as execution scope when the user explicitly says to execute tasks from it.
- Before shipping meaningful app changes, prefer this verification sequence:
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `npm run smoke`
- For production smoke tests, use:
  - `SMOKE_BASE_URL=https://eatlee.vercel.app npm run smoke`
- `scripts/smoke-test.ts` supports both local and remote smoke testing. Do not remove that dual-mode behavior.
- If working on admin auth, preserve the admin allowlist logic using `ADMIN_EMAIL` / `NEXT_PUBLIC_ADMIN_EMAIL`.
- If working on scoring, preserve `lib/formula.config.ts` as the only formula parameter source.

## In Scope

- Next.js + Supabase full-stack web application
- PYF score engine driven entirely by `formula.config.ts`
- Food listing, filtering, category-based browsing
- Multi-food comparison via modal (side-by-side)
- Admin panel: monthly price entry only
- WHO compliance badge per food item
- Responsive web (no native app)
- Vercel deployment under existing domain

## Out of Scope

- User accounts, authentication, personalization
- Processed foods, junk food, ready-to-eat meals, sugar products
- Blog, SEO optimization (deferred)
- Analytics, launch strategy (deferred)
- Native mobile app
- Ads or monetization of any kind

## Food Data Rules

- All nutritional values (protein, calories, fat, fiber, carbohydrates) are sourced manually from USDA FoodData Central
- Only whole, minimally processed foods are included
- Processed items (canned meals, sausages with additives, chocolate, chips, etc.) are excluded
- Traditional whole foods (e.g. plain sucuk, dried legumes) may be included at admin discretion
- 100 foods at launch across 5 categories:
  - Meat & Fish: ~20
  - Dairy & Eggs: ~15
  - Legumes, Grains & Pulses: ~25–30
  - Vegetables: ~20–25
  - Other: remainder

## Formula Rules

- The PYF formula lives exclusively in `formula.config.ts`
- Changing this file triggers automatic recalculation of all scores
- No hardcoded weights, references, or thresholds anywhere else in the codebase
- Macro target: 35% Carbohydrate / 35% Protein / 30% Fat

## Score & Ranking Rules

- Scores are calculated per category first, then a global rank is derived
- Top 30% within each category is marked "good"
- Global mixed list is available; category filter is optional
- Expensive foods (red meat, salmon) must not dominate the top of the global list — price-per-protein secondary sort handles this
- Scoring display: normalized 0–100 scale derived from raw geometric output
- Score tiers shown via color: high (accent yellow), mid (gray), low (soft red)

## WHO Integration

- WHO dietary guidelines inform reference values and badge criteria
- A "WHO compliant ✓" badge is displayed per food where applicable
- WHO data does not affect the PYF formula directly
