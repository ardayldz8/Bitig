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


