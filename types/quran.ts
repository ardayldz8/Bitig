/** Mealin ikinci kaynakla karşılaştırma sonucu (bkz. lib/quran/fetch.ts). */
export type Confirmation = "confirmed" | "differs" | "unavailable";

export type DeliveredTranslation = {
  edition: string;
  name: string;
  text: string;
  confirmation: Confirmation;
};

/** Gönderilmiş (ve belki kaydedilmiş) bir ayet. */
export type Delivery = {
  id: string;
  surah: number;
  ayah: number;
  surahName: string;
  surahNameLatin: string;
  arabic: string;
  translations: DeliveredTranslation[];
  /** Arapça metni teyit eden bağımsız kaynaklar */
  arabicSources: string[];
  sentAt: string;
  saved: boolean;
  savedAt: string | null;
  note: string;
};

export type QuranSettings = {
  enabled: boolean;
  editions: string[];
  timezone: string;
};

/** Günlük bildirim saati. */
export type Slot = {
  id: string;
  /** "HH:MM" */
  timeOfDay: string;
};

/** Kullanıcının istediği varsayılan vakitler. */
export const DEFAULT_TIMES = ["08:00", "12:00", "15:00", "18:00", "21:00"] as const;
