import { normalizeTitle } from "@/lib/media/sorting";
import type {
  MediaEntry,
  MediaFormErrors,
  MediaFormValues,
} from "@/types/media";

export const MIN_RELEASE_YEAR = 1888; // bilinen ilk film
export const MAX_RATING = 10;

export function maxReleaseYear(): number {
  return new Date().getFullYear() + 5;
}

/** "8,5" gibi virgüllü girdileri de kabul eder. Boşsa null. */
export function parseDecimal(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Boş girdiyi "belirtilmemiş" (null) sayan tam sayı ayrıştırma. */
function parseIntegerField(raw: string): { empty: boolean; value: number | null } {
  if (!raw.trim()) return { empty: true, value: null };
  const value = parseDecimal(raw);
  return { empty: false, value: value === null ? null : Math.round(value) };
}

export function isValidPosterUrl(raw: string): boolean {
  try {
    const url = new URL(raw.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function emptyFormValues(): MediaFormValues {
  return {
    title: "",
    mediaType: "series",
    releaseYear: "",
    status: "watching",
    rating: "",
    posterUrl: "",
    currentSeason: "1",
    currentEpisode: "1",
    totalSeasons: "",
    totalEpisodes: "",
    watchedEpisodes: "",
  };
}

const toField = (value: number | null): string => (value === null ? "" : String(value));

export function formValuesFromEntry(entry: MediaEntry): MediaFormValues {
  return {
    title: entry.title,
    mediaType: entry.mediaType,
    releaseYear: toField(entry.releaseYear),
    status: entry.status,
    rating: toField(entry.rating),
    posterUrl: entry.posterUrl ?? "",
    currentSeason: toField(entry.currentSeason),
    currentEpisode: toField(entry.currentEpisode),
    totalSeasons: toField(entry.totalSeasons),
    totalEpisodes: toField(entry.totalEpisodes),
    watchedEpisodes: toField(entry.watchedEpisodes),
  };
}

export type MediaValidationResult =
  | {
      ok: true;
      data: Omit<MediaEntry, "id" | "createdAt" | "updatedAt">;
    }
  | { ok: false; errors: MediaFormErrors };

/** Aynı ad + yıl kombinasyonu zaten var mı? (Düzenlemede kendisi hariç.) */
export function findDuplicate(
  title: string,
  releaseYear: number | null,
  entries: MediaEntry[],
  ignoreId: string | null,
): MediaEntry | null {
  const target = normalizeTitle(title);
  return (
    entries.find(
      (entry) =>
        entry.id !== ignoreId &&
        normalizeTitle(entry.title) === target &&
        entry.releaseYear === releaseYear,
    ) ?? null
  );
}

export function validateMediaForm(
  values: MediaFormValues,
  entries: MediaEntry[],
  editingId: string | null,
): MediaValidationResult {
  const errors: MediaFormErrors = {};

  const title = values.title.trim();
  if (!title) {
    errors.title = "Yapım adı boş bırakılamaz.";
  }

  // --- Çıkış yılı ---
  const yearField = parseIntegerField(values.releaseYear);
  let releaseYear: number | null = null;
  if (!yearField.empty) {
    if (yearField.value === null) {
      errors.releaseYear = "Geçerli bir yıl gir.";
    } else if (yearField.value < MIN_RELEASE_YEAR || yearField.value > maxReleaseYear()) {
      errors.releaseYear = `Yıl ${MIN_RELEASE_YEAR} ile ${maxReleaseYear()} arasında olmalı.`;
    } else {
      releaseYear = yearField.value;
    }
  }

  if (title && !errors.releaseYear) {
    const duplicate = findDuplicate(title, releaseYear, entries, editingId);
    if (duplicate) {
      errors.title = "Bu yapım (aynı ad ve yıl) zaten listende var.";
    }
  }

  // --- Puan (opsiyonel) ---
  let rating: number | null = null;
  if (values.rating.trim()) {
    const parsed = parseDecimal(values.rating);
    if (parsed === null) {
      errors.rating = "Geçerli bir puan gir.";
    } else if (parsed < 0 || parsed > MAX_RATING) {
      errors.rating = `Puan 0 ile ${MAX_RATING} arasında olmalı.`;
    } else {
      rating = parsed;
    }
  }

  // --- Poster URL (opsiyonel) ---
  let posterUrl: string | null = null;
  if (values.posterUrl.trim()) {
    if (!isValidPosterUrl(values.posterUrl)) {
      errors.posterUrl = "Geçerli bir adres gir (http:// veya https:// ile başlamalı).";
    } else {
      posterUrl = values.posterUrl.trim();
    }
  }

  // --- Dizi alanları (film ise hepsi null) ---
  let currentSeason: number | null = null;
  let currentEpisode: number | null = null;
  let totalSeasons: number | null = null;
  let totalEpisodes: number | null = null;
  let watchedEpisodes: number | null = null;

  if (values.mediaType === "series") {
    const season = parseIntegerField(values.currentSeason);
    if (season.empty || season.value === null) {
      errors.currentSeason = "Sezon gir.";
    } else if (season.value <= 0) {
      errors.currentSeason = "Sezon sıfırdan büyük olmalı.";
    } else {
      currentSeason = season.value;
    }

    const episode = parseIntegerField(values.currentEpisode);
    if (episode.empty || episode.value === null) {
      errors.currentEpisode = "Bölüm gir.";
    } else if (episode.value <= 0) {
      errors.currentEpisode = "Bölüm sıfırdan büyük olmalı.";
    } else {
      currentEpisode = episode.value;
    }

    const seasons = parseIntegerField(values.totalSeasons);
    if (!seasons.empty) {
      if (seasons.value === null || seasons.value <= 0) {
        errors.totalSeasons = "Toplam sezon sıfırdan büyük olmalı.";
      } else if (currentSeason !== null && seasons.value < currentSeason) {
        errors.totalSeasons = "Toplam sezon, mevcut sezondan küçük olamaz.";
      } else {
        totalSeasons = seasons.value;
      }
    }

    const episodes = parseIntegerField(values.totalEpisodes);
    if (!episodes.empty) {
      if (episodes.value === null || episodes.value <= 0) {
        errors.totalEpisodes = "Toplam bölüm sıfırdan büyük olmalı.";
      } else if (currentEpisode !== null && episodes.value < currentEpisode) {
        errors.totalEpisodes = "Toplam bölüm, mevcut bölümden küçük olamaz.";
      } else {
        totalEpisodes = episodes.value;
      }
    }

    const watched = parseIntegerField(values.watchedEpisodes);
    if (!watched.empty) {
      if (watched.value === null || watched.value < 0) {
        errors.watchedEpisodes = "İzlenen bölüm negatif olamaz.";
      } else if (totalEpisodes !== null && watched.value > totalEpisodes) {
        errors.watchedEpisodes = "İzlenen bölüm, toplam bölümden fazla olamaz.";
      } else {
        watchedEpisodes = watched.value;
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      title,
      mediaType: values.mediaType,
      currentSeason,
      currentEpisode,
      totalSeasons,
      totalEpisodes,
      watchedEpisodes,
      rating,
      status: values.status,
      posterUrl,
      releaseYear,
    },
  };
}
