export type MediaType = "series" | "movie";

export type WatchStatus = "watching" | "completed" | "planned";

export type MediaEntry = {
  id: string;

  title: string;
  mediaType: MediaType;

  currentSeason: number | null;
  currentEpisode: number | null;

  totalSeasons: number | null;
  totalEpisodes: number | null;

  /**
   * Kullanıcının bildirdiği toplam izlenen bölüm.
   * Sezon başına bölüm dağılımı bilinmediği için yüzde YALNIZCA bu değer
   * (ya da güvenli bir eşdeğeri) varken hesaplanır — uydurma yüzde üretilmez.
   */
  watchedEpisodes: number | null;

  rating: number | null;
  status: WatchStatus;

  posterUrl: string | null;
  releaseYear: number | null;

  createdAt: string;
  updatedAt: string;
};

export type MediaSortKey =
  | "recent"
  | "oldest"
  | "title-asc"
  | "title-desc"
  | "rating-desc"
  | "rating-asc"
  | "year-desc"
  | "year-asc"
  | "episode-desc";

export type StatusFilter = "all" | WatchStatus;
export type TypeFilter = "all" | MediaType;

export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  series: "Dizi",
  movie: "Film",
};

export const STATUS_LABELS: Record<WatchStatus, string> = {
  watching: "İzliyorum",
  completed: "Tamamlandı",
  planned: "Planlıyorum",
};

/** Formdaki ham (string) değerler — kullanıcı serbestçe yazabilsin diye. */
export type MediaFormValues = {
  title: string;
  mediaType: MediaType;
  releaseYear: string;
  status: WatchStatus;
  rating: string;
  posterUrl: string;
  currentSeason: string;
  currentEpisode: string;
  totalSeasons: string;
  totalEpisodes: string;
  watchedEpisodes: string;
};

export type MediaFormErrors = Partial<Record<keyof MediaFormValues, string>>;
