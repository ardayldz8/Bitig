/** Kişisel not. Projelere bağlı `project_notes`'tan ayrı, bağımsız kayıt. */
export type Note = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  updatedAt: string;
};

export type NoteDraft = {
  title: string;
  body: string;
};

/**
 * Bir notun hatırlatma saati. Bir notun birden çok hatırlatması olabilir.
 *
 * `days` ISO numaralandırma: 1=Pazartesi … 7=Pazar. BOŞ DİZİ "her gün" demek —
 * ayrı bir bayrak tutmaktan daha az durum yaratıyor.
 *
 * `time` yerel duvar saati ("08:30"); UTC'ye çevrilmiyor, çünkü "her sabah
 * 08:30" isteği yaz saatinde de 08:30 kalmalı.
 */
export type Reminder = {
  id: string;
  noteId: string;
  time: string;
  days: number[];
  enabled: boolean;
  timezone: string;
};

export type ReminderDraft = {
  time: string;
  days: number[];
};

export const GUN_ADLARI = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"] as const;

/** Hatırlatmanın ne zaman tekrarlayacağını insan diline çevirir. */
export function tekrarMetni(days: number[]): string {
  if (days.length === 0) return "Her gün";
  if (days.length === 7) return "Her gün";

  const sirali = [...days].sort((a, b) => a - b);

  // Hafta içi / hafta sonu gibi yaygın kümeleri tek tek saymak yerine adlandır
  const haftaIci = [1, 2, 3, 4, 5];
  const haftaSonu = [6, 7];
  if (sirali.join() === haftaIci.join()) return "Hafta içi";
  if (sirali.join() === haftaSonu.join()) return "Hafta sonu";

  return sirali.map((day) => GUN_ADLARI[day - 1]).join(", ");
}
