export type DashboardModule = "manga" | "calorie" | "media" | "projects";

export type DashboardRecentItem = {
  id: string;
  module: DashboardModule;
  title: string;
  subtitle: string;
  href: string;
  /** Gerçek zaman bilgisi yoksa null — uydurma saat gösterilmez. */
  updatedAt: string | null;
};

/** Bir modülün yükleme sonucu — hata tek modülde kalır, sayfayı çökertmez. */
export type ModuleResult<T> =
  | { state: "ok"; data: T }
  | { state: "empty" }
  | { state: "error"; message: string };

export type MangaSummary = {
  title: string;
  currentChapter: number;
};

export type CalorieSummary = {
  consumed: number;
  target: number;
};

export type MediaSummary = {
  title: string;
  mediaType: "series" | "movie";
  currentSeason: number | null;
  currentEpisode: number | null;
};

export type ProjectSummary = {
  id: string;
  name: string;
  status: string;
  updatedAt: string | null;
  /** Yalnızca önbellekte gerçek veri varsa dolar; ana sayfada GitHub çağrısı yapılmaz. */
  ciStatus: "success" | "failure" | "pending" | null;
  openIssues: number | null;
};

export type DashboardData = {
  manga: ModuleResult<MangaSummary>;
  calorie: ModuleResult<CalorieSummary>;
  media: ModuleResult<MediaSummary>;
  projects: ModuleResult<ProjectSummary>;
  recentItems: DashboardRecentItem[];
};
