import type {
  MediaEntry,
  MediaSortKey,
  StatusFilter,
  TypeFilter,
} from "@/types/media";

export const SORT_OPTIONS: { value: MediaSortKey; label: string }[] = [
  { value: "recent", label: "Son eklenen" },
  { value: "oldest", label: "İlk eklenen" },
  { value: "title-asc", label: "A–Z" },
  { value: "title-desc", label: "Z–A" },
  { value: "rating-desc", label: "En yüksek puan" },
  { value: "rating-asc", label: "En düşük puan" },
  { value: "year-desc", label: "En yeni yapım" },
  { value: "year-asc", label: "En eski yapım" },
  { value: "episode-desc", label: "En ileri bölüm" },
];

export function isSortKey(value: string): value is MediaSortKey {
  return SORT_OPTIONS.some((option) => option.value === value);
}

/**
 * Arama/karşılaştırma için ad normalleştirme.
 * Türkçe "I" sorunu: toLocaleLowerCase("tr") büyük I'yı noktasız ı'ya çevirir,
 * bu yüzden "DARK" araması "Dark" ile eşleşmezdi. Tüm i varyantları tek forma
 * indirgenir; diğer harfler için varsayılan toLowerCase doğrudur.
 */
export function normalizeTitle(value: string): string {
  return value
    .replace(/[İIı]/g, "i")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function searchEntries(entries: MediaEntry[], query: string): MediaEntry[] {
  const term = normalizeTitle(query);
  if (!term) return entries;
  return entries.filter((entry) => normalizeTitle(entry.title).includes(term));
}

export function filterEntries(
  entries: MediaEntry[],
  status: StatusFilter,
  type: TypeFilter,
): MediaEntry[] {
  return entries.filter((entry) => {
    if (status !== "all" && entry.status !== status) return false;
    if (type !== "all" && entry.mediaType !== type) return false;
    return true;
  });
}

/** null değerler her iki yönde de sona atılır. */
function compareNullable(a: number | null, b: number | null, desc: boolean): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return desc ? b - a : a - b;
}

/** Diziyi (sezon, bölüm) çiftine göre karşılaştırılabilir tek sayıya indirger. */
function episodePosition(entry: MediaEntry): number | null {
  if (entry.mediaType !== "series") return null;
  if (entry.currentSeason === null && entry.currentEpisode === null) return null;
  return (entry.currentSeason ?? 0) * 1000 + (entry.currentEpisode ?? 0);
}

/** Girdi dizisini bozmadan sıralanmış yeni dizi döndürür. */
export function sortEntries(entries: MediaEntry[], sort: MediaSortKey): MediaEntry[] {
  const sorted = [...entries];

  switch (sort) {
    case "recent":
      return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "oldest":
      return sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case "title-asc":
      return sorted.sort((a, b) => a.title.localeCompare(b.title, "tr"));
    case "title-desc":
      return sorted.sort((a, b) => b.title.localeCompare(a.title, "tr"));
    case "rating-desc":
      return sorted.sort((a, b) => compareNullable(a.rating, b.rating, true));
    case "rating-asc":
      return sorted.sort((a, b) => compareNullable(a.rating, b.rating, false));
    case "year-desc":
      return sorted.sort((a, b) => compareNullable(a.releaseYear, b.releaseYear, true));
    case "year-asc":
      return sorted.sort((a, b) => compareNullable(a.releaseYear, b.releaseYear, false));
    case "episode-desc":
      return sorted.sort((a, b) =>
        compareNullable(episodePosition(a), episodePosition(b), true),
      );
  }
}

/** En fazla bir ondalık, Türkçe yazımla (8,5). */
export function formatRating(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1).replace(".", ",");
}
