import type { MediaEntry } from "@/types/media";

export type MediaProgress =
  | {
      kind: "percent";
      watched: number;
      total: number;
      percent: number;
      /** 0-1 arası, göstergede taşma olmaması için sıkıştırılmış. */
      ratio: number;
    }
  | { kind: "position"; label: string }
  | { kind: "none" };

/**
 * İlerleme hesabı — KASITLI OLARAK MUHAFAZAKÂR.
 *
 * Veri modeli sezon bazlı olduğu ve sezon başına bölüm dağılımı bilinmediği
 * için "3. sezon 1. bölüm"den toplam izlenen bölüm sayısı ÇIKARILAMAZ.
 * Yüzde yalnızca aşağıdaki güvenilir durumlarda üretilir:
 *
 *  1. Kullanıcı izlenen toplam bölümü kendisi girdiyse
 *  2. Yapım tamamlandıysa (tüm bölümler izlenmiştir)
 *  3. Dizi tek sezonluksa (bölüm numarası zaten toplam izlenene eşittir)
 *
 * Diğer tüm hâllerde yüzde yerine konum bilgisi gösterilir.
 */
export function computeProgress(entry: MediaEntry): MediaProgress {
  if (entry.mediaType === "movie") return { kind: "none" };

  const total = entry.totalEpisodes;
  const watched = reliableWatchedEpisodes(entry);

  if (total !== null && total > 0 && watched !== null) {
    const capped = Math.min(watched, total);
    const percent = (capped / total) * 100;
    return {
      kind: "percent",
      watched: capped,
      total,
      percent,
      ratio: Math.min(1, Math.max(0, capped / total)),
    };
  }

  const label = positionLabel(entry);
  return label ? { kind: "position", label } : { kind: "none" };
}

/** Yüzde üretmeye yetecek kadar GÜVENİLİR izlenen bölüm sayısı (yoksa null). */
export function reliableWatchedEpisodes(entry: MediaEntry): number | null {
  if (entry.mediaType !== "series") return null;

  // 1) Kullanıcının doğrudan girdiği değer
  if (entry.watchedEpisodes !== null && entry.watchedEpisodes >= 0) {
    return entry.watchedEpisodes;
  }

  // 2) Tamamlanmış dizi → tüm bölümler izlenmiş demektir
  if (entry.status === "completed" && entry.totalEpisodes !== null) {
    return entry.totalEpisodes;
  }

  // 3) Tek sezonluk dizi → bölüm numarası doğrudan izlenen sayısıdır
  if (entry.totalSeasons === 1 && entry.currentEpisode !== null) {
    return entry.currentEpisode;
  }

  return null;
}

/** "3. Sezon · 1. Bölüm" biçiminde konum metni. */
export function positionLabel(entry: MediaEntry): string | null {
  if (entry.mediaType !== "series") return null;
  const parts: string[] = [];
  if (entry.currentSeason !== null) parts.push(`${entry.currentSeason}. Sezon`);
  if (entry.currentEpisode !== null) parts.push(`${entry.currentEpisode}. Bölüm`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Sezon başına ortalama bölüm — YALNIZCA öneri amaçlı kullanılır,
 * asla kayda yazılmaz ve yüzde hesabında kullanılmaz.
 */
export function estimatedEpisodesPerSeason(entry: MediaEntry): number | null {
  if (
    entry.totalEpisodes === null ||
    entry.totalSeasons === null ||
    entry.totalSeasons <= 0
  ) {
    return null;
  }
  return Math.round(entry.totalEpisodes / entry.totalSeasons);
}

/** `+` sonrası sonraki sezona geçme önerisi yapılmalı mı? */
export function shouldSuggestNextSeason(entry: MediaEntry, nextEpisode: number): boolean {
  if (entry.mediaType !== "series") return false;
  if (entry.currentSeason === null || entry.totalSeasons === null) return false;
  if (entry.currentSeason >= entry.totalSeasons) return false;

  const perSeason = estimatedEpisodesPerSeason(entry);
  if (perSeason === null || perSeason <= 0) return false;

  return nextEpisode > perSeason;
}
