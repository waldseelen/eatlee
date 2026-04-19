Read AGENT.md, ARCHITECTURE.md, README.md first. Treat them as one unified instruction set and follow all rules, constraints, and context strictly.

Then execute TASKS.md as the single source of truth. Only complete tasks marked [ ]. Never touch or redo tasks marked [x].

Do not deviate from scope, structure, or intent. If any conflict occurs, follow the most recent and most specific instruction.

After completing all eligible tasks, update PROGRESS.md briefly and accurately based on this session.

---

# TASKS.md — Eatlee

## Phase 1 — Architecture & Code Organization

- [ ] 1.1 Keep formula, table ranking, data assembly, and auth logic strictly separated into dedicated `lib/` modules
- [ ] 1.2 Introduce a clearer business-rules layer for shared domain logic such as scoring rules, WHO rules, and category rules
- [ ] 1.3 Preserve and document strict separation between public data access, admin mutation flows, and service-role server operations
- [ ] 1.4 Evaluate and introduce feature-first module organization if the codebase grows further (`foods`, `admin`, `compare`, `scoring`)
- [ ] 1.5 Keep `AGENT.md`, `ARCHITECTURE.md`, `README.md`, and runtime implementation aligned after structural changes

## Phase 2 — Data Model & Data Quality

- [ ] 2.1 Resolve the `100 foods` vs `137 foods` product/data inconsistency and align docs or dataset accordingly
- [ ] 2.2 Centralize category definitions across database constraints, TypeScript types, import logic, and UI labels
- [ ] 2.3 Add a validation step for `scripts/data/food-manifest.csv` to catch duplicates, blanks, invalid categories, and invalid prices
- [ ] 2.4 Add stronger USDA match review metadata or a lightweight review workflow for imported foods
- [ ] 2.5 Make WHO compliance more explainable by storing or deriving human-readable compliance reasons

## Phase 3 — Testing & Quality Assurance

- [ ] 3.1 Expand automated tests for combined category + macro-priority behavior and additional sort edge cases
- [ ] 3.2 Add route-level tests for admin API flows (`/api/admin/prices`, `/api/recalculate`) including auth and invalid payload cases
- [ ] 3.3 Strengthen smoke tests with deeper response-body assertions for successful recalculation flows
- [ ] 3.4 Introduce shared test factories/helpers for foods, prices, and scores to reduce duplicated fixture setup
- [ ] 3.5 Add a GitHub CI pipeline for lint, tests, and production build verification

## Phase 4 — Security, Ops & Deployment Maturity

- [ ] 4.1 Strengthen the admin authorization model beyond email allowlisting where appropriate
- [ ] 4.2 Add rate limiting or equivalent protections to sensitive admin mutation endpoints
- [ ] 4.3 Add baseline security headers suitable for the current Next.js + Vercel setup
- [ ] 4.4 Document Supabase, Vercel, smoke-test, and admin maintenance commands in the main developer-facing docs
- [ ] 4.5 Standardize a release validation flow for post-deploy public and admin smoke coverage

## Phase 5 — Product Consistency & UX Maintainability

- [ ] 5.1 Document macro-priority behavior clearly so product intent matches actual table ordering behavior
- [ ] 5.2 Define a single meaning for `Last updated` across admin and public surfaces
- [ ] 5.3 Centralize score tier presentation rules such as labels, colors, and explanatory text
- [ ] 5.4 Improve admin batch-edit usability with clearer changed-row and unsaved-change feedback patterns
- [ ] 5.5 Create a stable release / rollback / readiness document for ongoing maintenance
