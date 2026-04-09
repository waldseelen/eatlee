create extension if not exists pgcrypto;

create table if not exists foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('meat_fish', 'dairy_eggs', 'legumes_grains', 'vegetables', 'other')),
  protein numeric not null,
  calories numeric not null,
  fat numeric not null,
  saturated_fat numeric not null,
  fiber numeric not null,
  carbs numeric not null,
  net_carbs numeric not null,
  sodium numeric not null default 0,
  is_processed boolean not null default false,
  who_compliant boolean not null default false,
  usda_fdc_id text,
  created_at timestamptz not null default now()
);

create table if not exists prices (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references foods(id) on delete cascade,
  price_per_kg numeric not null check (price_per_kg > 0),
  updated_at timestamptz not null default now()
);

create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references foods(id) on delete cascade,
  pyf_raw numeric not null,
  pyf_normalized numeric not null,
  category_rank integer not null,
  global_rank integer not null,
  tier text not null check (tier in ('good', 'mid', 'low')),
  calculated_at timestamptz not null default now()
);

create table if not exists config_log (
  id uuid primary key default gen_random_uuid(),
  changed_at timestamptz not null default now(),
  changed_by text not null,
  snapshot jsonb not null
);

create unique index if not exists idx_scores_food_id_unique on scores(food_id);
create index if not exists idx_foods_category on foods(category);
create index if not exists idx_prices_food_id on prices(food_id);
create index if not exists idx_prices_food_id_updated_at on prices(food_id, updated_at desc);
create index if not exists idx_scores_global_rank on scores(global_rank);
create index if not exists idx_scores_category_rank on scores(category_rank);

alter table foods enable row level security;
alter table prices enable row level security;
alter table scores enable row level security;
alter table config_log enable row level security;

create policy "Public read foods"
  on foods for select
  using (true);

create policy "Public read prices"
  on prices for select
  using (true);

create policy "Public read scores"
  on scores for select
  using (true);
