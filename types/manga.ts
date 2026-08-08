export type MangaStatus = "reading" | "completed";

export type Manga = {
  id: string;
  name: string;
  currentChapter: number;
  rating: number;
  status: MangaStatus;
  /** Kapak görseli adresi. Yoksa/yüklenemezse harf yer tutucusu gösterilir. */
  coverUrl: string | null;

  /**
   * MangaDex kaydının kimliği. Kütüphane Türkçe çeviri adlarla tutulduğu ve
   * katalog özgün adlarla indeksli olduğu için otomatik eşleşme çalışmıyor
   * (8 mangada 1 tuttu, o da yanlış esere). Bağ bir kez kurulup saklanıyor.
   */
  mangadexId: string | null;
  /** Katalogdaki en son bölüm. Bağ kurulmamışsa null. */
  latestChapter: number | null;
};

/** Kayıt oluşturulurken/düzenlenirken kullanılan, id'siz manga verisi. */
export type MangaDraft = Omit<Manga, "id" | "mangadexId" | "latestChapter">;

export type SortKey =
  | "recent"
  | "name"
  | "rating-desc"
  | "rating-asc"
  | "chapter-desc"
  | "chapter-asc";

/** Formdaki ham (string) girdi değerleri — kullanıcı serbestçe yazabilsin diye. */
export type MangaFormValues = {
  name: string;
  currentChapter: string;
  rating: string;
  status: MangaStatus;
  coverUrl: string;
};

export type MangaFormErrors = Partial<
  Record<"name" | "currentChapter" | "rating" | "coverUrl", string>
>;
