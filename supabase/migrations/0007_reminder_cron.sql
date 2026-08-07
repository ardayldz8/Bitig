-- Hatırlatmaları dakikada bir gönderen zamanlanmış iş.
--
-- Neden Netlify değil: Netlify'ın zamanlanmış fonksiyonları en sık SAATTE BİR
-- çalışabiliyor. "08:30'da hatırlat" isteği için 59 dakikaya varan gecikme
-- demek bu. pg_cron dakikalık çözünürlük veriyor.
--
-- Neden veritabanından HTTP: gönderim mantığı (VAPID imzalama, payload
-- şifreleme) Node tarafında `web-push` ile yapılıyor. Aynısını Postgres içinde
-- yazmak, kriptografiyi elle uygulamak olurdu.
--
-- KURULUM: Bu dosya doğrudan çalıştırılamaz — iki değer projeye özel.
-- Aşağıdaki bloğu Supabase SQL Editor'da, yer tutucuları doldurarak çalıştır:
--
--   <SITE_URL>  Netlify'daki canlı adres, sonunda eğik çizgi olmadan
--               (ör. https://bitig.netlify.app)
--   <SECRET>    .env.local ve Netlify'daki REMINDER_DISPATCH_SECRET ile AYNI
--
-- Sır SQL metnine gömülü kalmasın diye Supabase Vault kullanılıyor; cron
-- tanımı pg_cron.job tablosunda düz metin olarak durur ve o tabloyu okuyabilen
-- herkes sırrı görebilirdi.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Sırları Vault'a koy (bir kez; tekrar çalıştırmak günceller)
select vault.create_secret('<SITE_URL>', 'bitig_site_url', 'Bitig canlı adresi');
select vault.create_secret('<SECRET>', 'bitig_dispatch_secret', 'Hatırlatma gönderim sırrı');

/*
 * Vault'tan okuyup çağrıyı yapan sarmalayıcı.
 *
 * pg_net asenkron: istek kuyruğa alınır, cron işi yanıtı beklemez. Bu iyi —
 * aksi hâlde yavaş bir yanıt cron çalışanını bloke ederdi.
 */
create or replace function public.dispatch_reminders()
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
    raise warning 'Bitig: gönderim sırları Vault''ta yok, hatırlatma atlandı';
    return;
  end if;

  -- pg_net'in fonksiyonları `net` şemasında (eklenti `extensions`'a kurulsa da)
  perform net.http_post(
    url     := site_url || '/api/reminders/dispatch',
    body    := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-dispatch-secret', gizli
    ),
    timeout_milliseconds := 20000
  );
end;
$$;

revoke all on function public.dispatch_reminders() from public, anon, authenticated;

-- Dakikada bir. Aynı adla zaten varsa önce kaldır ki tekrar çalıştırmak
-- ikinci bir iş oluşturmasın (bildirimler iki kez giderdi).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'bitig-hatirlatmalar') then
    perform cron.unschedule('bitig-hatirlatmalar');
  end if;
end $$;

select cron.schedule(
  'bitig-hatirlatmalar',
  '* * * * *',
  $$select public.dispatch_reminders()$$
);

-- Kontrol:
--   select * from cron.job where jobname = 'bitig-hatirlatmalar';
--   select * from cron.job_run_details order by start_time desc limit 5;
