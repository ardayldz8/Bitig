import type { MediaEntry } from "@/types/media";

export const MEDIA_STORAGE_KEY = "bitig.media.entries.v1";

const MEDIA_TYPES = new Set(["series", "movie"]);
const STATUSES = new Set(["watching", "completed", "planned"]);

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isMediaEntry(value: unknown): value is MediaEntry {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;

  return (
    typeof item.id === "string" &&
    item.id.length > 0 &&
    typeof item.title === "string" &&
    typeof item.mediaType === "string" &&
    MEDIA_TYPES.has(item.mediaType) &&
    isNullableNumber(item.currentSeason) &&
    isNullableNumber(item.currentEpisode) &&
    isNullableNumber(item.totalSeasons) &&
    isNullableNumber(item.totalEpisodes) &&
    isNullableNumber(item.rating) &&
    typeof item.status === "string" &&
    STATUSES.has(item.status) &&
    isNullableString(item.posterUrl) &&
    isNullableNumber(item.releaseYear) &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string"
  );
}

/**
 * Eski/bozuk kayıtları da kabul edip eksik alanları tamamlar.
 * `watchedEpisodes` sonradan eklendiği için kayıtta olmayabilir.
 */
function normalize(entry: MediaEntry & { watchedEpisodes?: unknown }): MediaEntry {
  return {
    ...entry,
    watchedEpisodes: isNullableNumber(entry.watchedEpisodes)
      ? entry.watchedEpisodes
      : null,
  };
}

/** SSR'da çağrılmaz; yalnızca mount sonrası kullanılır. */
export function readMediaEntries(): MediaEntry[] | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(MEDIA_STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    // Bozuk öğeler atılır, geçerliler korunur → uygulama asla çökmez
    return parsed.filter(isMediaEntry).map(normalize);
  } catch {
    return null;
  }
}

export function writeMediaEntries(entries: MediaEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MEDIA_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Kota dolu / erişilemez (ör. Safari gizli mod) — uygulama çalışmaya devam eder
  }
}

/**
 * İlk açılış örnek verisi.
 * Fonksiyon olarak tutulur: `new Date()` çağrısı modül yüklenirken değil,
 * yalnızca istemcide mount sonrası çalışır → hydration uyuşmazlığı olmaz.
 */
export function createInitialEntries(): MediaEntry[] {
  const now = new Date().toISOString();
  const base = { createdAt: now, updatedAt: now, posterUrl: null };

  return [
    {
      ...base,
      id: "dark",
      title: "Dark",
      mediaType: "series",
      currentSeason: 3,
      currentEpisode: 1,
      totalSeasons: 3,
      totalEpisodes: 26,
      watchedEpisodes: null,
      rating: 10,
      status: "watching",
      releaseYear: 2017,
    },
    {
      ...base,
      id: "breaking-bad",
      title: "Breaking Bad",
      mediaType: "series",
      currentSeason: 5,
      currentEpisode: 14,
      totalSeasons: 5,
      totalEpisodes: 62,
      watchedEpisodes: null,
      rating: 10,
      status: "completed",
      releaseYear: 2008,
    },
    {
      ...base,
      id: "attack-on-titan",
      title: "Attack on Titan",
      mediaType: "series",
      currentSeason: 4,
      currentEpisode: 6,
      totalSeasons: 4,
      totalEpisodes: 94,
      watchedEpisodes: null,
      rating: 9,
      status: "watching",
      releaseYear: 2013,
    },
    {
      ...base,
      id: "interstellar",
      title: "Interstellar",
      mediaType: "movie",
      currentSeason: null,
      currentEpisode: null,
      totalSeasons: null,
      totalEpisodes: null,
      watchedEpisodes: null,
      rating: 9,
      status: "completed",
      releaseYear: 2014,
    },
    {
      ...base,
      id: "inception",
      title: "Inception",
      mediaType: "movie",
      currentSeason: null,
      currentEpisode: null,
      totalSeasons: null,
      totalEpisodes: null,
      watchedEpisodes: null,
      rating: 8,
      status: "planned",
      releaseYear: 2010,
    },
  ];
}

const TR_CHAR_MAP: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  ö: "o",
  ş: "s",
  ü: "u",
};

/** Ada dayalı, çakışmayan deterministik id. */
export function createMediaId(title: string, existing: MediaEntry[]): string {
  const base =
    title
      .replace(/[İIı]/g, "i")
      .toLowerCase()
      .replace(/[çğöşü]/g, (char) => TR_CHAR_MAP[char] ?? char)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "yapim";

  const taken = new Set(existing.map((entry) => entry.id));
  if (!taken.has(base)) return base;

  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}
