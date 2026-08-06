export type MangaStatus = "reading" | "completed";

export type Manga = {
  id: string;
  name: string;
  currentChapter: number;
  rating: number;
  status: MangaStatus;
};

/** Kayıt oluşturulurken/düzenlenirken kullanılan, id'siz manga verisi. */
export type MangaDraft = Omit<Manga, "id">;

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
};

export type MangaFormErrors = Partial<Record<"name" | "currentChapter" | "rating", string>>;
