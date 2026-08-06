-- Puanlar ondalıklı olabiliyor.
--
-- 0002'de `rating integer` tanımlanmıştı; arayüz ise 8,5 gibi değerlere izin
-- veriyor (lib/manga.ts ve lib/media/validation.ts ondalık ayrıştırıyor).
-- Integer sütuna 8.5 yazılınca Postgres sessizce 8'e yuvarlıyordu — hata
-- vermeden veri kaybı. Sütunlar numeric'e çevriliyor.

alter table public.mangas
  alter column rating type numeric using rating::numeric;

alter table public.media_entries
  alter column rating type numeric using rating::numeric;
