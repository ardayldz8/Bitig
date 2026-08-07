import type { CatalogItem, CatalogKind } from "@/lib/catalog/types";

const TIMEOUT_MS = 10_000;
const USER_AGENT = "Bitig/0.1 (kisisel takip)";

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    // Doğrulama başarısızsa öneri elenir; hata fırlatıp tüm listeyi düşürmek
    // tek bir kaynağın anlık arızasını "hiç öneri yok"a çevirirdi.
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/** Noktalama ve büyük/küçük farkını yutan karşılaştırma anahtarı. */
function anahtar(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

/**
 * Başlıklar aynı eseri mi gösteriyor — TAM eşleşme aranır.
 *
 * Önce önek eşleşmesine de izin veriliyordu ve yanlış eser döndürüyordu:
 * "Gantz" araması spin-off olan "Gantz: E"yi kabul ediyordu. Önerilen eserin
 * yanlış olması, hiç önerilmemesinden kötü.
 */
function ayniEser(aranan: string, bulunan: string): boolean {
  const a = anahtar(aranan);
  const b = anahtar(bulunan);
  return a.length > 0 && a === b;
}

// ------------------------------------------------------------------ Manga

async function mangaDex(title: string, signal?: AbortSignal): Promise<CatalogItem | null> {
  /*
   * contentRating: `pornographic` dışında hepsi açık.
   *
   * Önce yalnızca safe+suggestive isteniyordu ve Berserk gibi ana akım seinen
   * başlıkları sessizce eleniyordu — MangaDex onları `erotica` sayıyor.
   * Tek kullanıcılı kişisel bir uygulamada bu filtre kimseyi korumuyor,
   * yalnızca yanlış "bulunamadı" üretiyordu.
   */
  /*
   * limit=20: MangaDex'in `title` araması semantik ve sıralaması zayıf.
   * "Kingdom" araması önce "Oukoku" (krallık) geçen Japonca başlıkları
   * döndürüyor; gerçek Kingdom 11. sırada çıkıyor. 5 sonuçla bakarken
   * ana akım başlıklar "bulunamadı" sayılıyordu.
   *
   * contentRating: `pornographic` dışında hepsi açık. Yalnızca safe+suggestive
   * istenirken Berserk gibi ana akım seinen başlıkları eleniyordu — MangaDex
   * onları `erotica` sayıyor. Tek kullanıcılı kişisel bir uygulamada bu filtre
   * kimseyi korumuyor, yalnızca yanlış "bulunamadı" üretiyordu.
   */
  const url =
    `https://api.mangadex.org/manga?title=${encodeURIComponent(title)}` +
    `&limit=20&includes[]=cover_art` +
    `&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica`;

  const data = await getJson(url, signal);
  const list = (data as { data?: unknown })?.data;
  if (!Array.isArray(list)) return null;

  type MangaRow = {
    id?: string;
    attributes?: {
      title?: Record<string, string>;
      altTitles?: Record<string, string>[];
      description?: Record<string, string>;
      year?: number | null;
    };
    relationships?: { type?: string; attributes?: { fileName?: string } }[];
  };

  const rows = list as MangaRow[];

  const anaBasliklar = (row: MangaRow) => Object.values(row.attributes?.title ?? {});
  const altBasliklar = (row: MangaRow) =>
    (row.attributes?.altTitles ?? []).flatMap((entry) => Object.values(entry));

  /*
   * İki geçiş: önce ANA başlıkta tam eşleşme, sonra ALT başlıkta.
   *
   * Sırası önemli: "Gantz" araması tek geçişte renkli yeniden baskı olan
   * "Gantz Color Ban"i yakalıyordu (alt başlıklarından biri "Gantz"). Asıl
   * eserin ana başlığı tam eşleştiği için önce o bulunmalı.
   *
   * Alt başlık geçişi de şart: "Blade of the Immortal"ın MangaDex'teki ana
   * başlığı "Mugen no Junin"; İngilizce adı yalnızca alt başlıklarda var.
   */
  const anaEslesme = rows.find((row) =>
    anaBasliklar(row).some((ad) => ayniEser(title, ad)),
  );
  const eslesen =
    anaEslesme ?? rows.find((row) => altBasliklar(row).some((ad) => ayniEser(title, ad)));

  if (!eslesen?.id) return null;

  const titles = eslesen.attributes?.title ?? {};
  /*
   * Gösterilecek ad. Alt başlıktan eşleştiysek ARANAN adı kullan: MangaDex'in
   * ana başlığı romanize Japonca olabiliyor ve kullanıcı "Mugen no Junin"
   * kartını görünce önerdiğimiz "Blade of the Immortal" ile bağlantı kuramaz.
   */
  const ad = titles.en ?? (anaEslesme ? undefined : title) ?? Object.values(titles)[0];
  if (!ad) return null;

  const cover = eslesen.relationships?.find((rel) => rel.type === "cover_art");
  const dosya = cover?.attributes?.fileName;
  const aciklama = eslesen.attributes?.description;

  return {
    title: ad,
    year: eslesen.attributes?.year ?? null,
    // .256.jpg küçük boy: kart görselleri için tam boy kapak gereksiz ağır
    imageUrl: dosya
      ? `https://uploads.mangadex.org/covers/${eslesen.id}/${dosya}.256.jpg`
      : null,
    description: aciklama?.en ?? Object.values(aciklama ?? {})[0] ?? null,
    sourceUrl: `https://mangadex.org/title/${eslesen.id}`,
    source: "mangadex",
  };
}

// ------------------------------------------------------------------- Dizi

async function tvMaze(title: string, signal?: AbortSignal): Promise<CatalogItem | null> {
  const data = await getJson(
    `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(title)}`,
    signal,
  );
  if (!Array.isArray(data)) return null;

  for (const raw of data.slice(0, 3)) {
    const show = (raw as { show?: Record<string, unknown> }).show;
    if (!show) continue;

    const ad = typeof show.name === "string" ? show.name : null;
    if (!ad || !ayniEser(title, ad)) continue;

    const premiered = typeof show.premiered === "string" ? show.premiered : null;
    const image = show.image as { medium?: string } | null;
    const summary = typeof show.summary === "string" ? show.summary : null;

    return {
      title: ad,
      year: premiered ? Number(premiered.slice(0, 4)) || null : null,
      imageUrl: image?.medium ?? null,
      // TVMaze özetleri HTML; etiketler arayüzde ham metin olarak görünürdü
      description: summary ? summary.replace(/<[^>]*>/g, "").trim() : null,
      sourceUrl: typeof show.url === "string" ? show.url : null,
      source: "tvmaze",
    };
  }

  return null;
}

// ------------------------------------------------------------------- Film

async function wikipedia(title: string, signal?: AbortSignal): Promise<CatalogItem | null> {
  /*
   * İki adım: önce arama, sonra özet. Doğrudan başlıkla özet çekmek
   * denenmedi çünkü model "Oldboy" diyor ama Wikipedia başlığı
   * "Oldboy (2003 film)" — tam başlığı bilmesini beklemek kırılgan olurdu.
   */
  const arama = await getJson(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*` +
      `&srlimit=3&srsearch=${encodeURIComponent(`${title} film`)}`,
    signal,
  );

  const hits = (arama as { query?: { search?: { title?: string }[] } })?.query?.search;
  if (!Array.isArray(hits) || hits.length === 0) return null;

  for (const hit of hits) {
    const wikiTitle = hit.title;
    if (!wikiTitle) continue;

    // "Inception" ↔ "Inception (2010 film)": parantezli niteleyiciyi at
    const cikarilmis = wikiTitle.replace(/\s*\([^)]*\)\s*$/, "");
    if (!ayniEser(title, cikarilmis)) continue;

    const ozet = await getJson(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
        wikiTitle.replace(/ /g, "_"),
      )}`,
      signal,
    );
    if (!ozet || typeof ozet !== "object") continue;

    const record = ozet as {
      titles?: { normalized?: string };
      extract?: string;
      thumbnail?: { source?: string };
      content_urls?: { desktop?: { page?: string } };
      description?: string;
    };

    // Film olmayan sayfalar (kitap, oyun, albüm) elenmeli
    const tanim = `${record.description ?? ""} ${record.extract ?? ""}`.toLowerCase();
    if (!tanim.includes("film") && !tanim.includes("movie")) continue;

    const yil = record.extract?.match(/\b(19|20)\d{2}\b/)?.[0];

    return {
      // "Parasite (2019 film)" değil "Parasite": niteleyici arayüzde gürültü
      title: (record.titles?.normalized ?? cikarilmis).replace(/\s*\([^)]*\)\s*$/, ""),
      year: yil ? Number(yil) : null,
      imageUrl: record.thumbnail?.source ?? null,
      description: record.extract ?? null,
      sourceUrl: record.content_urls?.desktop?.page ?? null,
      source: "wikipedia",
    };
  }

  return null;
}

/**
 * Önerilen eseri türüne uygun katalogda doğrular.
 * Bulunamazsa null — çağıran taraf o öneriyi listeden düşürür.
 */
export function verifyInCatalog(
  kind: CatalogKind,
  title: string,
  signal?: AbortSignal,
): Promise<CatalogItem | null> {
  switch (kind) {
    case "manga":
      return mangaDex(title, signal);
    case "series":
      return tvMaze(title, signal);
    case "movie":
      return wikipedia(title, signal);
  }
}
