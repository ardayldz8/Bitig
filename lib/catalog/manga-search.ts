const API = "https://api.mangadex.org";
const USER_AGENT = "Bitig/0.1 (kisisel takip)";
const TIMEOUT_MS = 12_000;

export type MangaCandidate = {
  id: string;
  title: string;
  altTitles: string[];
  year: number | null;
  coverUrl: string | null;
  latestChapter: number | null;
  status: string | null;
};

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
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

type MangaRow = {
  id?: string;
  attributes?: {
    title?: Record<string, string>;
    altTitles?: Record<string, string>[];
    year?: number | null;
    status?: string | null;
    lastChapter?: string | null;
  };
  relationships?: { type?: string; attributes?: { fileName?: string } }[];
};

function toCandidate(row: MangaRow): MangaCandidate | null {
  if (!row.id) return null;
  const titles = row.attributes?.title ?? {};
  const title = titles.en ?? Object.values(titles)[0];
  if (!title) return null;

  const cover = row.relationships?.find((rel) => rel.type === "cover_art");
  const dosya = cover?.attributes?.fileName;

  /*
   * `lastChapter` yalnızca tamamlanmış eserlerde dolu; devam edenlerde boş.
   * Gerçek son bölüm ayrıca bölüm akışından okunuyor (latestChapter), bu
   * alan sadece bir ipucu.
   */
  const son = row.attributes?.lastChapter;
  const sonSayi = son ? Number(son) : NaN;

  return {
    id: row.id,
    title,
    altTitles: (row.attributes?.altTitles ?? [])
      .flatMap((entry) => Object.values(entry))
      .slice(0, 4),
    year: row.attributes?.year ?? null,
    coverUrl: dosya ? `https://uploads.mangadex.org/covers/${row.id}/${dosya}.256.jpg` : null,
    latestChapter: Number.isFinite(sonSayi) ? sonSayi : null,
    status: row.attributes?.status ?? null,
  };
}

/** Serbest metinle katalogda arama — eşleştirme ekranı için aday listesi. */
export async function searchMangaCandidates(
  query: string,
  signal?: AbortSignal,
): Promise<MangaCandidate[]> {
  const url =
    `${API}/manga?title=${encodeURIComponent(query)}&limit=8&includes[]=cover_art` +
    `&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica` +
    `&order[relevance]=desc`;

  const data = await getJson(url, signal);
  const list = (data as { data?: unknown })?.data;
  if (!Array.isArray(list)) return [];

  const adaylar = (list as MangaRow[])
    .map(toCandidate)
    .filter((item): item is MangaCandidate => item !== null);

  /*
   * Adayların gerçek son bölümü ayrıca çekiliyor.
   *
   * Aynı eserin MangaDex'te birden çok kaydı olabiliyor ve bölüm sayıları
   * çok farklı: "Solo Leveling" aramasında bir kayıtta 194, diğerinde 56
   * bölüm var. 213. bölümde olan biri için 56 bölümlük aday açıkça yanlış —
   * ama bu sayı gösterilmezse ikisi ayırt edilemiyor.
   *
   * `lastChapter` alanı bu iş için yetmiyor: devam eden eserlerin çoğunda
   * boş. İlk beş aday için akıştan okunuyor; gerisi eşleştirmede zaten
   * seçilmiyor.
   */
  const zenginlestirilmis = await Promise.all(
    adaylar.slice(0, 5).map(async (aday) => ({
      ...aday,
      latestChapter: (await latestChapterOf(aday.id, signal)) ?? aday.latestChapter,
    })),
  );

  return [...zenginlestirilmis, ...adaylar.slice(5)];
}

/**
 * Bir eserin yayımlanmış EN SON bölüm numarası.
 *
 * `attributes.lastChapter` çoğu devam eden eserde boş olduğu için bölüm
 * akışından okunuyor. Çeviri dili sınırlandırılmıyor: kullanıcı Türkçe
 * okuyor olabilir ama "yeni bölüm çıktı mı" sorusunun cevabı herhangi bir
 * dildeki en yüksek bölüm numarası.
 */
export async function latestChapterOf(
  mangaId: string,
  signal?: AbortSignal,
): Promise<number | null> {
  const url =
    `${API}/manga/${encodeURIComponent(mangaId)}/feed` +
    `?limit=1&order[chapter]=desc&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica`;

  const data = await getJson(url, signal);
  const list = (data as { data?: unknown })?.data;
  if (!Array.isArray(list) || list.length === 0) return null;

  const bolum = (list[0] as { attributes?: { chapter?: string | null } })?.attributes?.chapter;
  if (!bolum) return null;

  const sayi = Number(bolum);
  return Number.isFinite(sayi) ? sayi : null;
}
