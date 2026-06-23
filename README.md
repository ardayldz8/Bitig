# Bitig

Yapay zeka destekli, Solo Leveling "System" temalı **kişisel takip PWA'sı**. Sistemi
**asistanla konuşarak** yönetirsin — o senin yerine kaydı yapar.

- 💬 Sohbetle kayıt: alışkanlık / görev / ruh hali / günlük
- 🍽️ Beslenme: yemeği yaz, AI kalori + makro (protein/karb/yağ) hesaplar, günlük bütçeden düşer (profil → TDEE hedefi)
- 🎯 Hedefler, 🔁 günlük rutinler, ⏰ bildirimli hatırlatmalar
- 🧬 Oyunlaştırma: XP / Level / Rank (E→S), STR/INT/VIT/DEX, HP & ceza, unvanlar & başarımlar
- ⚔️ Günlük questler ve ⛩ çok adımlı **zindanlar** (dungeon)
- ✎ Kayıt düzenleme / yeniden kategorize (dokunarak veya sohbetle)

## Yığın

Next.js 15 (App Router, TS) · Tailwind v4 · Supabase (Auth + Postgres + RLS) ·
OpenRouter / Gemini (AI) · Web Push (VAPID) · PWA.

## Geliştirme

```bash
npm install
cp .env.local.example .env.local   # değerleri doldur
npm run dev
```

## Ortam değişkenleri

`.env.local` (yerelde) ve **Netlify → Site settings → Environment variables** (canlıda):

| Değişken | Zorunlu | Açıklama |
|----------|---------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ (build'de gerekli) | Supabase proje URL'i |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ (build'de gerekli) | Supabase publishable/anon anahtarı |
| `OPENROUTER_API_KEY` | önerilir | Birincil AI (OpenRouter) |
| `GEMINI_API_KEY` | opsiyonel | Yedek AI (Google Gemini) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | push için | Web Push VAPID public anahtarı |

> `NEXT_PUBLIC_*` değişkenleri **build sırasında** koda gömülür; Netlify'da derlemeden
> önce tanımlı olmalı. Sırlar (`OPENROUTER_API_KEY`, `GEMINI_API_KEY`) yalnızca sunucuda
> kullanılır ve `.env.local` repoya **commit edilmez**.

## Netlify'a deploy

1. Bu repoyu Netlify'da "Add new site → Import from Git" ile bağla.
2. Next.js otomatik algılanır (`@netlify/plugin-nextjs`); build komutu `npm run build`.
3. Yukarıdaki ortam değişkenlerini ekle ve deploy et.
4. Deploy sonrası **Supabase → Authentication → URL Configuration**'da Site URL ve
   Redirect URLs'e Netlify alan adını ekle (magic-link girişi için).

## Lisans

Kişisel proje.
