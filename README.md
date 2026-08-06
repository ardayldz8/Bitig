<div align="center">
  <img src="public/icon-192.png" alt="Bitig" width="88" height="88">
  <h1>Bitig</h1>
  <p>Manga, kalori, dizi/film ve yazılım projelerini tek yerden takip et.</p>
</div>

Kişisel takip uygulaması. Kurulabilir bir PWA olarak çalışır. Giriş yapmadan
hiçbir sayfa açılmaz; tüm veriler hesabına bağlı olarak Supabase'de saklanır ve
cihazlar arasında senkron olur.

## Sayfalar

| Route | Ne yapar |
|---|---|
| `/` | Dört modülün özeti, son kaldıkların ve hızlı işlemler |
| `/manga` | Okunan mangalar, bölüm sayacı, puan, arama ve sıralama |
| `/kalori` | Fotoğraf/barkod/etiket ile besin takibi, günlük hedef ve makrolar |
| `/dizi-film` | İzlenen dizi ve filmler, sezon/bölüm takibi, filtreler |
| `/projeler` | Yazılım projeleri, özellikler, notlar, görevler, GitHub ve AI asistan |

## Yığın

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 ·
Supabase (Postgres + Auth + Realtime) · OpenRouter · Zod · Vitest

## Başlangıç

```bash
npm install
cp .env.local.example .env.local   # değerleri doldur (hepsi opsiyonel)
npm run dev
```

`http://localhost:3000` adresinde açılır. **Supabase değişkenleri zorunludur** —
uygulama verileri hesaba bağlı tuttuğu için onlarsız açılmaz ve kurulum uyarısı
gösterir. Diğer entegrasyonlar opsiyoneldir; eksik olan sessizce devre dışı kalır.

Google ile giriş için Supabase panelinde Authentication → Providers → Google
açılmalı ve Authentication → URL Configuration altındaki Redirect URLs listesine
uygulamanın adresi eklenmelidir. Sağlayıcı kapalıyken e-posta/şifre ile giriş
çalışmaya devam eder.

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Üretim derlemesi |
| `npm run lint` | ESLint |
| `npm test` | Vitest birim testleri |

## Ortam değişkenleri

Supabase dışındakiler opsiyonel; eksik olan entegrasyon sessizce devre dışı kalır.

| Değişken | Olmazsa ne olur |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Zorunlu** — uygulama açılmaz, kurulum uyarısı gösterilir |
| `SUPABASE_SERVICE_ROLE_KEY` | GitHub webhook'u veritabanına yazamaz |
| `OPENROUTER_API_KEY` | Fotoğraf analizi ve AI asistan kapalı |
| `GITHUB_APP_*`, `GITHUB_WEBHOOK_SECRET` | GitHub entegrasyonu kapalı |
| `FATSECRET_*`, `USDA_API_KEY` | O besin kaynakları atlanır (Open Food Facts anahtarsız çalışır) |

Supabase şeması: `supabase/migrations/`.

## Tasarım kararları

Bu projede birkaç kural bilinçli olarak katı tutuldu:

- **AI besin değeri üretmez.** Model yalnızca fotoğraftaki yiyeceği tanır;
  kalori ve makrolar yalnızca Open Food Facts, FatSecret ve USDA'dan gelir.
  Hiçbiri sonuç vermezse değer uydurulmaz, kullanıcıdan manuel giriş istenir.
- **AI GitHub'a yazamaz.** Yalnızca taslak üretir; issue açılması `confirmed`
  bayrağı gerektirir ve bu bayrak yalnızca kullanıcının onay diyaloğundan gelir.
- **Uydurma ilerleme yok.** Sezon başına bölüm dağılımı bilinmediğinde yüzde
  gösterilmez; `updatedAt` olmayan kayıtta saat gösterilmez.
- **Giriş yapılmadan hiçbir şey render edilmez.** Sayfa içeriği gizlenmez,
  hiç çizilmez; navbar da öyle. Depoda saklanan oturum jetonu `getUser()` ile
  sunucuda doğrulanır — silinmiş hesabın jetonu süresi dolana kadar duvarı
  geçmesin diye.
- **Yerel veri sessizce yok sayılmaz.** Buluta geçişten önce tarayıcıda
  kaydedilmiş manga/kalori/dizi kayıtları için bir kez aktarım teklif edilir.
  Bulutta zaten kayıt varsa o modül atlanır ve yereldeki veri silinmez.
- **GitHub kurulumunun sahibi var.** `installation_id` gizli değildir; bu yüzden
  repo okuma, senkronizasyon ve issue uçları kurulumun isteği yapan kullanıcıya
  ait olduğunu RLS üzerinden doğrular. Doğrulanmamış istek 401/403 alır.
- **Repo içeriği veridir, talimat değildir.** README, commit mesajı ve issue
  metinleri modele `<proje_verisi>` etiketiyle verilir; secret içerebilecek
  dosyalar hiç gönderilmez.
- **Servis worker kişisel veri önbelleklemez.** Yalnızca uygulama kabuğu;
  `/api`, Supabase ve GitHub istekleri önbelleğe alınmaz.

## Testler

```bash
npm test
```

Webhook imza doğrulama, GitHub payload normalize etme, proje sağlık metrikleri,
form doğrulama, AI structured-output doğrulama ve Markdown XSS savunması.

## Lisans

Kişisel proje.
