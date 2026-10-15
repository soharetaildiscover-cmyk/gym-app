-- ============================================================================
-- Nutrition and progress
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Food database. created_by null = shared database; otherwise a user's own food.
-- Values are per 100 g.
-- ---------------------------------------------------------------------------
create table public.foods (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  brand       text,
  kcal        numeric(6, 1) not null check (kcal >= 0),
  protein_g   numeric(5, 1) not null default 0 check (protein_g >= 0),
  carbs_g     numeric(5, 1) not null default 0 check (carbs_g >= 0),
  fat_g       numeric(5, 1) not null default 0 check (fat_g >= 0),
  serving_g   numeric(6, 1),           -- a typical serving, for quick add
  serving_label text,                  -- "1 egg", "1 cup"
  source      text not null default 'seed',
  created_by  uuid references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index foods_name on public.foods (lower(name));

-- ---------------------------------------------------------------------------
-- Meals: meal -> items. Items keep their own numbers (a snapshot), so fixing a
-- food later never changes what was logged last month.
-- ---------------------------------------------------------------------------
create table public.meals (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references public.profiles (id) on delete cascade,
  eaten_on    date not null default current_date,
  meal_type   text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  photo_path  text,
  notes       text not null default '',
  client_id   uuid unique,
  created_at  timestamptz not null default now(),
  unique (id, athlete_id)
);
create index meals_athlete_day on public.meals (athlete_id, eaten_on desc);

create table public.meal_items (
  id          uuid primary key default gen_random_uuid(),
  meal_id     uuid not null,
  athlete_id  uuid not null,
  food_id     uuid references public.foods (id) on delete set null,
  name        text not null,
  grams       numeric(6, 1),
  kcal        numeric(6, 1) not null check (kcal >= 0),
  protein_g   numeric(5, 1) not null default 0,
  carbs_g     numeric(5, 1) not null default 0,
  fat_g       numeric(5, 1) not null default 0,
  created_at  timestamptz not null default now(),
  foreign key (meal_id, athlete_id) references public.meals (id, athlete_id) on delete cascade
);
create index meal_items_meal on public.meal_items (meal_id);

create table public.saved_meals (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references public.profiles (id) on delete cascade,
  name        text not null,
  items       jsonb not null default '[]',   -- [{ food_id, name, grams, kcal, protein_g, carbs_g, fat_g }]
  created_at  timestamptz not null default now()
);

create table public.water_logs (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references public.profiles (id) on delete cascade,
  logged_on   date not null default current_date,
  ml          integer not null check (ml between 1 and 5000),
  created_at  timestamptz not null default now()
);
create index water_logs_athlete_day on public.water_logs (athlete_id, logged_on desc);

-- Targets are never edited in place: a new row takes effect from a date,
-- so the history of what the target was stays true.
create table public.nutrition_targets (
  id              uuid primary key default gen_random_uuid(),
  athlete_id      uuid not null references public.profiles (id) on delete cascade,
  set_by          uuid not null references public.profiles (id) on delete cascade,
  kcal            integer not null check (kcal between 800 and 8000),
  protein_g       integer not null check (protein_g between 0 and 600),
  carbs_g         integer not null check (carbs_g between 0 and 1200),
  fat_g           integer not null check (fat_g between 0 and 400),
  water_ml        integer check (water_ml between 0 and 10000),
  effective_from  date not null default current_date,
  created_at      timestamptz not null default now()
);
create index nutrition_targets_athlete on public.nutrition_targets (athlete_id, effective_from desc, created_at desc);

-- ---------------------------------------------------------------------------
-- Progress
-- ---------------------------------------------------------------------------
create table public.measurements (
  id            uuid primary key default gen_random_uuid(),
  athlete_id    uuid not null references public.profiles (id) on delete cascade,
  measured_on   date not null default current_date,
  weight_kg     numeric(5, 2) check (weight_kg between 20 and 400),
  body_fat_pct  numeric(4, 1) check (body_fat_pct between 2 and 75),
  waist_cm      numeric(5, 1),
  chest_cm      numeric(5, 1),
  arm_cm        numeric(4, 1),
  hip_cm        numeric(5, 1),
  thigh_cm      numeric(5, 1),
  source        text not null default 'manual' check (source in ('manual', 'checkin', 'health')),
  created_at    timestamptz not null default now()
);
create index measurements_athlete on public.measurements (athlete_id, measured_on desc);

create table public.progress_photos (
  id            uuid primary key default gen_random_uuid(),
  athlete_id    uuid not null references public.profiles (id) on delete cascade,
  taken_on      date not null default current_date,
  angle         text not null default 'front' check (angle in ('front', 'side', 'back', 'other')),
  storage_path  text not null,   -- "<athlete_id>/<file>" in the private progress-photos bucket
  checkin_id    uuid,            -- linked in the check-ins migration
  created_at    timestamptz not null default now()
);
create index progress_photos_athlete on public.progress_photos (athlete_id, taken_on desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.foods             enable row level security;
alter table public.meals             enable row level security;
alter table public.meal_items        enable row level security;
alter table public.saved_meals       enable row level security;
alter table public.water_logs        enable row level security;
alter table public.nutrition_targets enable row level security;
alter table public.measurements      enable row level security;
alter table public.progress_photos   enable row level security;

create policy "foods: read shared and own" on public.foods
  for select to authenticated using (created_by is null or created_by = (select auth.uid()));
create policy "foods: write own" on public.foods
  for all to authenticated
  using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));

create policy "meals: athlete owns" on public.meals
  for all to authenticated using (athlete_id = (select auth.uid())) with check (athlete_id = (select auth.uid()));
create policy "meals: coach reads with nutrition scope" on public.meals
  for select to authenticated using (public.coach_can_see(athlete_id, 'nutrition'));

create policy "meal items: athlete owns" on public.meal_items
  for all to authenticated using (athlete_id = (select auth.uid())) with check (athlete_id = (select auth.uid()));
create policy "meal items: coach reads with nutrition scope" on public.meal_items
  for select to authenticated using (public.coach_can_see(athlete_id, 'nutrition'));

create policy "saved meals: athlete owns" on public.saved_meals
  for all to authenticated using (athlete_id = (select auth.uid())) with check (athlete_id = (select auth.uid()));

create policy "water: athlete owns" on public.water_logs
  for all to authenticated using (athlete_id = (select auth.uid())) with check (athlete_id = (select auth.uid()));
create policy "water: coach reads with nutrition scope" on public.water_logs
  for select to authenticated using (public.coach_can_see(athlete_id, 'nutrition'));

-- targets: the athlete sets their own; an active coach with nutrition scope can set them too.
create policy "targets: athlete reads own" on public.nutrition_targets
  for select to authenticated using (athlete_id = (select auth.uid()));
create policy "targets: coach reads with nutrition scope" on public.nutrition_targets
  for select to authenticated using (public.coach_can_see(athlete_id, 'nutrition'));
create policy "targets: athlete or coach adds" on public.nutrition_targets
  for insert to authenticated with check (
    set_by = (select auth.uid())
    and (athlete_id = (select auth.uid()) or public.coach_can_see(athlete_id, 'nutrition'))
  );
revoke update, delete on public.nutrition_targets from authenticated;

create policy "measurements: athlete owns" on public.measurements
  for all to authenticated using (athlete_id = (select auth.uid())) with check (athlete_id = (select auth.uid()));
create policy "measurements: coach reads with progress scope" on public.measurements
  for select to authenticated using (public.coach_can_see(athlete_id, 'progress'));

create policy "photos: athlete owns" on public.progress_photos
  for all to authenticated using (athlete_id = (select auth.uid())) with check (athlete_id = (select auth.uid()));
create policy "photos: coach reads with photos scope" on public.progress_photos
  for select to authenticated using (public.coach_can_see(athlete_id, 'photos'));
