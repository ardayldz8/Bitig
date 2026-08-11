-- Günde birkaç kez rastgele ayet bildirimi ve beğenilenleri kaydetme.
--
-- Metin uygulamada TUTULMUYOR, gönderim anında dış kaynaklardan çekiliyor ve
-- çapraz doğrulanıyor (lib/quran/fetch.ts). Buradaki tablolar yalnızca
-- kullanıcının tercihlerini, gönderilmiş ayetin o anki metnini ve
-- kaydettiklerini tutuyor.
--
-- Gönderilen metnin saklanma sebebi: bildirime tıklandığında ayeti yeniden
-- çekmek gerekseydi kaynak o an erişilemez olabilir ve kullanıcı kendisine
-- gönderilen ayeti göremezdi. Ayrıca kaydedilen bir ayetin metni, kaynak
-- ilerde değişse bile kaydedildiği hâliyle kalmalı.

-- --------------------------------------------------------------- Ayarlar

create table if not exists public.quran_settings (
  user_id    uuid primary key references auth.users(id) on delete cascade,

  enabled    boolean not null default true,

  /*
   * Gösterilecek mealler. Birden çok tutuluyor çünkü tek bir meal "doğru
   * meal" değil — her biri mütercimin yorumu. Yan yana okumak, tek birine
   * bakmaktan daha doğru bir izlenim veriyor.
   */
  editions   text[] not null default array['tr.diyanet', 'tr.yazir'],

  -- Saatler yerel duvar saati; çevrim gönderim anında yapılıyor (bkz. 0006)
  timezone   text not null default 'Europe/Istanbul',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Hiç meal seçilmemiş ayar işe yaramaz; bildirimin gövdesi boş kalırdı
  constraint quran_settings_editions_not_empty check (cardinality(editions) > 0),
  -- Üstten sınır: her meal ek bir teyit isteği demek, gönderim 10 sn'yi aşmamalı
  constraint quran_settings_editions_max check (cardinality(editions) <= 4)
);

-- ------------------------------------------------------- Bildirim saatleri

/*
 * Ayrı tablo, `note_reminders` ile aynı gerekçeyle: günde birden çok saat
 * isteniyor (08:00 · 12:00 · 15:00 · 18:00 · 21:00) ve her birinin kendi
 * "bugün gönderildi mi" durumu var.
 */
create table if not exists public.quran_slots (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,

  time_of_day  time not null,

  -- En son hangi YEREL günde gönderildiği (cron dakikada bir çalışıyor)
  last_sent_on date,

  created_at   timestamptz not null default now(),

  -- Aynı saat iki kez eklenirse o vakit iki bildirim giderdi
  unique (user_id, time_of_day)
);

create index if not exists quran_slots_user_idx on public.quran_slots(user_id, time_of_day);

-- ---------------------------------------------------------- Gönderilenler

create table if not exists public.quran_deliveries (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,

  surah            smallint not null,
  ayah             smallint not null,
  surah_name       text not null default '',
  surah_name_latin text not null default '',

  arabic           text not null,

  /*
   * Mealler: [{edition, name, text, confirmation}]
   * `confirmation` üç değerli — 'confirmed' | 'differs' | 'unavailable'.
   * "kaynak farklı dedi" ile "kaynağa ulaşılamadı" aynı şey değil ve
   * kullanıcıya da farklı gösteriliyor.
   */
  translations     jsonb not null,

  -- Arapça metni teyit eden bağımsız kaynaklar; en az iki tane olmadan
  -- kayıt zaten oluşmuyor (uygulama tarafında engelleniyor)
  arabic_sources   text[] not null default '{}',

  sent_at          timestamptz not null default now(),

  -- Kullanıcı beğenip kaydettiyse
  saved            boolean not null default false,
  saved_at         timestamptz,
  -- Kaydedilen ayete kişisel not
  note             text not null default '',

  constraint quran_deliveries_surah_range check (surah between 1 and 114),
  constraint quran_deliveries_ayah_range check (ayah between 1 and 286)
);

create index if not exists quran_deliveries_user_idx
  on public.quran_deliveries(user_id, sent_at desc);

-- Kaydedilenler listesi bu indeksle geliyor
create index if not exists quran_deliveries_saved_idx
  on public.quran_deliveries(user_id, saved_at desc) where saved;

-- Yakın zamanda gönderilen ayetin tekrar seçilmemesi için
create index if not exists quran_deliveries_ref_idx
  on public.quran_deliveries(user_id, surah, ayah, sent_at desc);

-- --------------------------------------------------------------- RLS

alter table public.quran_settings   enable row level security;
alter table public.quran_slots      enable row level security;
alter table public.quran_deliveries enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['quran_settings', 'quran_slots', 'quran_deliveries']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_owner', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)',
      t || '_owner', t
    );

    -- 0004'teki AAL2 zorunluluğu yeni tablolara da uygulanmalı
    execute format('drop policy if exists %I on public.%I', t || '_require_mfa', t);
    execute format(
      'create policy %I on public.%I as restrictive to authenticated
         using (public.mfa_satisfied()) with check (public.mfa_satisfied())',
      t || '_require_mfa', t
    );
  end loop;
end $$;

-- -------------------------------------------------- Zamanı gelen saatler

/*
 * `due_reminders` ile aynı desen: yerel saate çevir, bugün gönderilmediyse
 * ve saat penceresi içindeyse döndür.
 *
 * Pencere 10 dakika: cron dakikada bir çalışıyor ama bir çalıştırma
 * kaçarsa (Netlify soğuk başlatma, geçici hata) bildirim tamamen düşmesin.
 */
create or replace function public.due_quran_slots()
returns table (
  slot_id    uuid,
  user_id    uuid,
  editions   text[],
  timezone   text,
  local_date date
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id, s.user_id, c.editions, c.timezone,
    (now() at time zone c.timezone)::date
  from public.quran_slots s
  join public.quran_settings c on c.user_id = s.user_id
  where c.enabled
    and ((now() at time zone c.timezone)::date is distinct from s.last_sent_on)
    and (now() at time zone c.timezone)
        >= ((now() at time zone c.timezone)::date + s.time_of_day)
    and (now() at time zone c.timezone)
        < ((now() at time zone c.timezone)::date + s.time_of_day + interval '10 minutes')
$$;

/*
 * security definer olduğu için RLS'i atlıyor — yalnızca service_role
 * çağırabilmeli (bkz. 0006'daki aynı gerekçe).
 */
revoke all on function public.due_quran_slots() from public, anon, authenticated;
grant execute on function public.due_quran_slots() to service_role;

-- ---------------------------------------------- Ayet gönderim zamanlaması

/*
 * Neden AYRI cron işi ve ayrı uç:
 *
 * Ayet gönderimi dış kaynaklardan çekip çapraz doğruluyor; ölçümde ortanca
 * 1 saniye, en yavaş 3.2 saniye sürüyor. Not hatırlatmaları ve abonelik
 * bildirimleriyle aynı Netlify çağrısına konsaydı ikisi birlikte 10 saniyelik
 * sınırı zorlayabilirdi ve yavaş bir ayet çağrısı hatırlatmaları da
 * düşürürdü. Ayrı uç, bütçeleri birbirinden bağımsız tutuyor.
 *
 * Sırlar 0007'de Vault'a yazıldı; bu dosya onları tekrar oluşturmuyor.
 */
create or replace function public.dispatch_quran()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  site_url text;
  gizli    text;
begin
  select decrypted_secret into site_url
  from vault.decrypted_secrets where name = 'bitig_site_url';

  select decrypted_secret into gizli
  from vault.decrypted_secrets where name = 'bitig_dispatch_secret';

  if site_url is null or gizli is null then
    raise warning 'Bitig: ayet gönderim sırları Vault''ta yok, atlandı';
    return;
  end if;

  perform net.http_post(
    url     := site_url || '/api/quran/dispatch',
    body    := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-dispatch-secret', gizli
    ),
    timeout_milliseconds := 20000
  );
end;
$$;

revoke all on function public.dispatch_quran() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'bitig-ayet') then
    perform cron.unschedule('bitig-ayet');
  end if;
end $$;

select cron.schedule(
  'bitig-ayet',
  '* * * * *',
  $$select public.dispatch_quran()$$
);

-- Kontrol:
--   select * from cron.job where jobname = 'bitig-ayet';
--   select * from public.due_quran_slots();
