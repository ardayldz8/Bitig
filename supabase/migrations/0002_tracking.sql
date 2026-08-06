-- Manga, kalori ve dizi/film verisi.
--
-- Bu üç modül daha önce yalnızca localStorage kullanıyordu: cihazlar arasında
-- senkron yoktu ve tarayıcı verisi silinince kayıtlar gidiyordu. Tablolar
-- 0001_projects.sql'deki desenle aynı: user_id + RLS, politika `authenticated`
-- rolüne bağlı ve auth.uid() alt sorgu içinde (satır başına yeniden
-- değerlendirilmesin diye).

-- ---------------------------------------------------------------- Manga

create table if not exists public.mangas (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  current_chapter integer not null default 0,
  rating          integer not null default 0,
  status          text not null default 'reading',
  cover_url       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint mangas_status_check check (status in ('reading', 'completed')),
  constraint mangas_rating_check check (rating between 0 and 10),
  constraint mangas_chapter_check check (current_chapter >= 0)
);

create index if not exists mangas_user_idx on public.mangas(user_id, created_at desc);

-- ---------------------------------------------------------------- Kalori

create table if not exists public.food_entries (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,

  name                   text not null,
  brand                  text,

  quantity               numeric not null,
  unit                   text not null,

  calories               numeric not null,
  protein                numeric not null,
  carbohydrates          numeric not null,
  fat                    numeric not null,

  meal_type              text not null,

  -- Besin değerinin nereden geldiği. Uygulama bu alanı uydurmaz; AI yalnızca
  -- yiyeceği tanır, değerler yalnızca dış kaynaklardan veya kullanıcıdan gelir.
  source                 text not null,
  source_food_id         text,

  -- Kullanıcı elle düzenlemeden önceki değerler
  original_calories      numeric,
  original_protein       numeric,
  original_carbohydrates numeric,
  original_fat           numeric,
  manually_edited        boolean not null default false,

  confidence             numeric,

  consumed_at            timestamptz not null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint food_entries_meal_check
    check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  constraint food_entries_unit_check
    check (unit in ('g', 'ml', 'piece', 'portion')),
  constraint food_entries_quantity_check check (quantity > 0)
);

-- Kalori sayfası hep "belirli bir günün kayıtları" diye sorguluyor
create index if not exists food_entries_user_day_idx
  on public.food_entries(user_id, consumed_at desc);

-- Hedefler kullanıcı başına tek satır
create table if not exists public.nutrition_targets (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  calories      numeric not null,
  protein       numeric not null,
  carbohydrates numeric not null,
  fat           numeric not null,
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------- Dizi / Film

create table if not exists public.media_entries (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,

  title           text not null,
  media_type      text not null,

  current_season  integer,
  current_episode integer,
  total_seasons   integer,
  total_episodes  integer,

  -- Sezon başına bölüm dağılımı bilinmediğinden ilerleme yüzdesi yalnızca bu
  -- değer varken hesaplanır; boşsa yüzde gösterilmez, uydurulmaz.
  watched_episodes integer,

  rating          integer,
  status          text not null default 'watching',

  poster_url      text,
  release_year    integer,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint media_entries_type_check check (media_type in ('series', 'movie')),
  constraint media_entries_status_check
    check (status in ('watching', 'completed', 'planned')),
  constraint media_entries_rating_check check (rating is null or rating between 0 and 10)
);

create index if not exists media_entries_user_idx
  on public.media_entries(user_id, created_at desc);

-- ---------------------------------------------------------------- RLS

alter table public.mangas            enable row level security;
alter table public.food_entries      enable row level security;
alter table public.nutrition_targets enable row level security;
alter table public.media_entries     enable row level security;

drop policy if exists mangas_owner on public.mangas;
create policy mangas_owner on public.mangas
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists food_entries_owner on public.food_entries;
create policy food_entries_owner on public.food_entries
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists nutrition_targets_owner on public.nutrition_targets;
create policy nutrition_targets_owner on public.nutrition_targets
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists media_entries_owner on public.media_entries;
create policy media_entries_owner on public.media_entries
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- Realtime

do $$
declare
  t text;
begin
  foreach t in array array['mangas', 'food_entries', 'nutrition_targets', 'media_entries']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
