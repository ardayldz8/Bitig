import type {
  Manga,
  MangaDraft,
  MangaFormErrors,
  MangaFormValues,
  SortKey,
} from "@/types/manga";

export const MAX_RATING = 10;

export const initialMangas: Manga[] = [
  {
    id: "berserk",
    name: "Berserk",
    currentChapter: 376,
    rating: 10,
    status: "completed",
    coverUrl: null,
  },
  {
    id: "vagabond",
    name: "Vagabond",
    currentChapter: 327,
    rating: 9,
    status: "reading",
    coverUrl: null,
  },
  {
    id: "one-piece",
    name: "One Piece",
    currentChapter: 1124,
    rating: 9,
    status: "reading",
    coverUrl: null,
  },
  {
    id: "kingdom",
    name: "Kingdom",
    currentChapter: 812,
    rating: 8,
    status: "reading",
    coverUrl: null,
  },
];

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Son eklenen" },
  { value: "name", label: "Manga adı" },
  { value: "rating-desc", label: "En yüksek puan" },
  { value: "rating-asc", label: "En düşük puan" },
  { value: "chapter-desc", label: "En yüksek bölüm" },
  { value: "chapter-asc", label: "En düşük bölüm" },
];

const TR_CHAR_MAP: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  ö: "o",
  ş: "s",
  ü: "u",
};

/**
 * Karşılaştırma (arama + mükerrer kontrolü) için ad normalleştirme.
 *
 * toLocaleLowerCase("tr") kullanılmaz: Türkçe kuralında büyük "I" noktasız "ı"ya
 * döner, bu yüzden "PIECE" araması "One Piece" ile eşleşmezdi. Bunun yerine tüm
 * i varyantları (I / İ / ı) tek bir "i"ye indirgenir; diğer harfler için
 * varsayılan toLowerCase zaten doğru sonucu verir (Ç→ç, Ş→ş, Ğ→ğ …).
 */
export function normalizeName(name: string): string {
  return name
    .replace(/[İIı]/g, "i")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(name: string): string {
  return normalizeName(name)
    .replace(/[çğıöşü]/g, (char) => TR_CHAR_MAP[char] ?? char)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Ada dayalı, mevcut kayıtlarla çakışmayan deterministik id üretir. */
export function createMangaId(name: string, existing: Manga[]): string {
  const base = slugify(name) || "manga";
  const taken = new Set(existing.map((manga) => manga.id));
  if (!taken.has(base)) return base;

  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

/** Aynı ada sahip başka bir kayıt var mı? (Düzenlemede kendisi hariç tutulur.) */
export function hasDuplicateName(
  name: string,
  existing: Manga[],
  ignoreId: string | null,
): boolean {
  const target = normalizeName(name);
  return existing.some(
    (manga) => manga.id !== ignoreId && normalizeName(manga.name) === target,
  );
}

export function searchMangas(list: Manga[], query: string): Manga[] {
  const term = normalizeName(query);
  if (!term) return list;
  return list.filter((manga) => normalizeName(manga.name).includes(term));
}

/** Girdi dizisini bozmadan sıralanmış yeni bir dizi döndürür. */
export function sortMangas(list: Manga[], sort: SortKey): Manga[] {
  const sorted = [...list];
  switch (sort) {
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name, "tr"));
    case "rating-desc":
      return sorted.sort((a, b) => b.rating - a.rating);
    case "rating-asc":
      return sorted.sort((a, b) => a.rating - b.rating);
    case "chapter-desc":
      return sorted.sort((a, b) => b.currentChapter - a.currentChapter);
    case "chapter-asc":
      return sorted.sort((a, b) => a.currentChapter - b.currentChapter);
    case "recent":
      return sorted;
  }
}

/**
 * Tam sayıları olduğu gibi, ondalıkları Türkçe yazımla (virgüllü) gösterir.
 * toLocaleString kullanılmaz: sunucuda ICU eksikse istemciyle farklı sonuç
 * üretip hydration uyuşmazlığına yol açabilirdi.
 */
export function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
}

export function coverLetter(name: string): string {
  const first = name.trim().charAt(0);
  return first ? first.toLocaleUpperCase("tr") : "?";
}

/** "8,5" gibi virgüllü girdileri de kabul eden sayı ayrıştırma. */
function parseNumber(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function emptyFormValues(): MangaFormValues {
  return { name: "", currentChapter: "", rating: "", status: "reading", coverUrl: "" };
}

export function formValuesFromManga(manga: Manga): MangaFormValues {
  return {
    name: manga.name,
    currentChapter: String(manga.currentChapter),
    rating: String(manga.rating),
    status: manga.status,
    coverUrl: manga.coverUrl ?? "",
  };
}

/** Kapak adresi yalnızca http/https olabilir. */
export function isValidCoverUrl(raw: string): boolean {
  try {
    const url = new URL(raw.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export type ValidationResult =
  | { ok: true; draft: MangaDraft }
  | { ok: false; errors: MangaFormErrors };

/**
 * Form değerlerini doğrular. Başarılıysa kaydedilebilir bir MangaDraft,
 * değilse alan bazlı hata mesajları döner.
 */
export function validateMangaForm(
  values: MangaFormValues,
  existing: Manga[],
  editingId: string | null,
): ValidationResult {
  const errors: MangaFormErrors = {};

  const name = values.name.trim();
  if (!name) {
    errors.name = "Manga adı boş bırakılamaz.";
  } else if (hasDuplicateName(name, existing, editingId)) {
    errors.name = "Bu isimde bir manga zaten var.";
  }

  const chapter = parseNumber(values.currentChapter);
  if (chapter === null) {
    errors.currentChapter = "Geçerli bir bölüm numarası gir.";
  } else if (chapter < 0) {
    errors.currentChapter = "Bölüm numarası negatif olamaz.";
  }

  const rating = parseNumber(values.rating);
  if (rating === null) {
    errors.rating = "Geçerli bir puan gir.";
  } else if (rating < 0 || rating > MAX_RATING) {
    errors.rating = `Puan 0 ile ${MAX_RATING} arasında olmalı.`;
  }

  // Kapak adresi opsiyonel; doluysa geçerli bir http(s) adresi olmalı
  let coverUrl: string | null = null;
  if (values.coverUrl.trim()) {
    if (!isValidCoverUrl(values.coverUrl)) {
      errors.coverUrl = "Geçerli bir adres gir (http:// veya https:// ile başlamalı).";
    } else {
      coverUrl = values.coverUrl.trim();
    }
  }

  if (Object.keys(errors).length > 0 || chapter === null || rating === null) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    draft: { name, currentChapter: chapter, rating, status: values.status, coverUrl },
  };
}
