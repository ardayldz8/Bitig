-- Kişisel notlar ve zamanlanmış hatırlatmalar.
--
-- `project_notes` tablosundan ayrı: o notlar bir projeye bağlı ve proje
-- silinince gidiyor. Buradakiler günlük hayata ait, bağımsız kayıtlar.
--
-- Desen 0001/0002 ile aynı: user_id + RLS, politika `authenticated` rolüne
-- bağlı ve auth.uid() alt sorgu içinde.

-- ---------------------------------------------------------------- Notlar

create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,

  title      text not null default '',
  body       text not null default '',

  -- Sabitlenen notlar listenin başında durur
  pinned     boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Tamamen boş not kaydedilmesin; en az biri dolu olmalı
  constraint notes_not_empty check (length(trim(title)) > 0 or length(trim(body)) > 0)
);

create index if not exists notes_user_idx
  on public.notes(user_id, pinned desc, updated_at desc);

-- ------------------------------------------------------- Hatırlatma saatleri

/*
 * Bir notun birden çok hatırlatma saati olabilir (sabah 08:00 ve akşam 21:00
 * gibi), bu yüzden ayrı tablo.
 *
 * Saat YEREL saat olarak tutuluyor, UTC'ye çevrilmiyor: "her gün 08:00'de"
 * isteği yaz saati uygulaması ya da seyahat durumunda da 08:00 kalmalı.
 * Çevrimi gönderim anında `timezone` alanına göre yapıyoruz.
 */
create table if not exists public.note_reminders (
  id           uuid primary key default gen_random_uuid(),
  note_id      uuid not null references public.notes(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,

  -- Yerel duvar saati (saniye kullanılmıyor)
  time_of_day  time not null,

  /*
   * Tekrar edeceği günler, ISO numaralandırmasıyla 1=Pazartesi … 7=Pazar.
   * Boş dizi "her gün" demek — ayrı bir "daily" bayrağı tutmaktan daha az
   * durum yaratıyor.
   */
  days_of_week smallint[] not null default '{}',

  timezone     text not null default 'Europe/Istanbul',
  enabled      boolean not null default true,

  /*
   * En son hangi YEREL günde gönderildiği. Cron dakikada bir çalıştığı için
   * bu olmadan aynı hatırlatma aynı dakika penceresinde birden çok kez
   * gönderilebilirdi.
   */
  last_sent_on date,

  created_at   timestamptz not null default now(),

  constraint note_reminders_days_check check (
    days_of_week <@ array[1,2,3,4,5,6,7]::smallint[]
  )
);

create index if not exists note_reminders_note_idx on public.note_reminders(note_id);
-- Gönderim işi yalnızca açık hatırlatmaları tarar
create index if not exists note_reminders_due_idx
  on public.note_reminders(enabled, time_of_day) where enabled;

-- ---------------------------------------------------------- Push abonelikleri

/*
 * Tarayıcının push aboneliği. Kullanıcı birden çok cihazdan (telefon, masaüstü)
 * abone olabilir; her cihaz ayrı satır.
 *
 * endpoint benzersiz: aynı cihaz yeniden abone olduğunda yeni satır açmak
 * yerine mevcut satır güncellenir, yoksa her izin tazelemesinde çift bildirim
 * giderdi.
 */
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,

  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,

  -- Hangi cihaz olduğunu kullanıcıya gösterebilmek için
  user_agent  text,

  created_at  timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions(user_id);

-- ---------------------------------------------------------------- RLS

alter table public.notes enable row level security;
alter table public.note_reminders enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists notes_owner on public.notes;
create policy notes_owner on public.notes
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists note_reminders_owner on public.note_reminders;
create policy note_reminders_owner on public.note_reminders
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists push_subscriptions_owner on public.push_subscriptions;
create policy push_subscriptions_owner on public.push_subscriptions
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ------------------------------------------------------ Zamanı gelenler

/*
 * Gönderilmesi gereken hatırlatmalar.
 *
 * Saat dilimi hesabı burada, veritabanında yapılıyor: her hatırlatmanın kendi
 * `timezone` alanı var ve "yerel şimdi" ona göre çözülüyor. Aynı hesabı
 * uygulama tarafında yapmak, yaz saati geçişlerinde ve DST'siz dilimlerde
 * hataya çok açık olurdu.
 *
 * 10 dakikalık pencere: cron bir tur atlarsa (soğuk başlangıç, kısa kesinti)
 * hatırlatma yine de gidiyor. Daha geniş tutmak, sabah 08:00 hatırlatmasının
 * öğlen düşmesi anlamına gelirdi — o noktada bildirim faydadan çok gürültü.
 *
 * Gece yarısına yakın saatlerde pencere gün sonunda kesiliyor (23:55 için
 * 23:59'a kadar). Geç kalmasındansa hiç gitmemesi yeğ.
 */
create or replace function public.due_reminders()
returns table (
  reminder_id uuid,
  user_id     uuid,
  note_id     uuid,
  title       text,
  body        text,
  local_date  date
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id, r.user_id, r.note_id, n.title, n.body,
    (now() at time zone r.timezone)::date
  from public.note_reminders r
  join public.notes n on n.id = r.note_id
  where r.enabled
    -- Bugün zaten gönderildiyse tekrar gönderme (cron dakikada bir çalışıyor)
    and ((now() at time zone r.timezone)::date is distinct from r.last_sent_on)
    -- Boş dizi "her gün" demek
    and (
      cardinality(r.days_of_week) = 0
      or extract(isodow from (now() at time zone r.timezone))::smallint = any(r.days_of_week)
    )
    and (now() at time zone r.timezone)
        >= ((now() at time zone r.timezone)::date + r.time_of_day)
    and (now() at time zone r.timezone)
        < ((now() at time zone r.timezone)::date + r.time_of_day + interval '10 minutes')
$$;

/*
 * security definer olduğu için RLS'i atlıyor — yalnızca sunucu tarafındaki
 * service_role çağırabilmeli. Aksi hâlde giriş yapmış herhangi biri BÜTÜN
 * kullanıcıların notlarını bu fonksiyonla okuyabilirdi.
 */
revoke all on function public.due_reminders() from public, anon, authenticated;
grant execute on function public.due_reminders() to service_role;

-- 0004'teki AAL2 zorunluluğu yeni tablolara da uygulanmalı; aksi hâlde
-- şifreyi bilen biri TOTP olmadan notları okuyabilirdi.
do $$
declare
  t text;
begin
  foreach t in array array['notes', 'note_reminders', 'push_subscriptions']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_require_mfa', t);
    execute format(
      'create policy %I on public.%I as restrictive to authenticated
         using (public.mfa_satisfied()) with check (public.mfa_satisfied())',
      t || '_require_mfa', t
    );
  end loop;
end $$;
