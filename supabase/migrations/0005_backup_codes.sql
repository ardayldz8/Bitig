-- TOTP kurtarma kodları.
--
-- Supabase'in MFA'sında yedek kod yok: authenticator kaybolduğunda tek çıkış
-- yolu panelden faktörü silmek. Tek kullanıcılı bir uygulamada bile bu
-- kırılgan — telefon kaybolduğunda panele erişim de olmayabilir.
--
-- Kodlar HASH'li saklanır. Tek kullanımlıktır; `used_at` dolduktan sonra
-- tekrar kabul edilmez.

create table if not exists public.mfa_backup_codes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  -- SHA-256 hex. Kodlar yüksek entropili rastgele dizeler olduğu için
  -- yavaş hash (bcrypt/argon) gerekmiyor; sözlük saldırısı hedefi yok.
  code_hash  text not null,
  used_at    timestamptz,
  created_at timestamptz not null default now(),

  constraint mfa_backup_codes_hash_key unique (user_id, code_hash)
);

create index if not exists mfa_backup_codes_user_idx
  on public.mfa_backup_codes(user_id) where used_at is null;

alter table public.mfa_backup_codes enable row level security;

-- Kullanıcı YALNIZCA kendi kodlarının durumunu görebilir (kaç tane kaldı).
-- Doğrulama ve tüketme service role ile sunucu tarafında yapılır; istemciye
-- hash bile verilmez.
drop policy if exists mfa_backup_codes_owner on public.mfa_backup_codes;
create policy mfa_backup_codes_owner on public.mfa_backup_codes
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- DİKKAT: bu tabloya 0004'teki aal2 kısıtı UYGULANMAZ.
-- Kurtarma akışı tanımı gereği aal1'de çalışır — aal2 şart koşulsaydı
-- authenticator'ı kaybeden kullanıcı kendi kurtarma kodlarını göremezdi.
