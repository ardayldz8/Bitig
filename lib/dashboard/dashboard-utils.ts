/** Ana sayfa biçimlendirme yardımcıları. */

const DATE_FORMATTER = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  weekday: "long",
});

/** "6 Ağustos 2026, Perşembe" — gerçek sistem tarihinden. */
export function formatToday(date: Date = new Date()): string {
  const parts = DATE_FORMATTER.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const weekday = get("weekday");
  const base = `${get("day")} ${get("month")} ${get("year")}`;
  return weekday ? `${base}, ${weekday}` : base;
}

/**
 * "Bugün, 17:42" / "Dün, 09:15" / "3 Ağustos".
 * Geçersiz veya boş tarihte null döner — uydurma zaman gösterilmez.
 */
export function formatUpdatedAt(iso: string | null): string | null {
  if (!iso) return null;

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

  if (sameDay) return `Bugün, ${time}`;
  if (isYesterday) return `Dün, ${time}`;

  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
}

/** "Son güncelleme: bugün" biçiminde kısa ifade. */
export function relativeDayLabel(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  if (date.toDateString() === now.toDateString()) return "bugün";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "dün";

  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
}

/** Binlik ayraçlı tam sayı (1.420). */
export function formatInteger(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** İlerleme oranı 0-1 arasına sıkıştırılır — gösterge asla taşmaz. */
export function progressRatio(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.min(Math.max(value / total, 0), 1);
}

/** İlk isim: "Arda Yıldız" → "Arda", e-posta → yerel kısım. */
export function displayName(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const base = trimmed.includes("@") ? trimmed.split("@")[0] : trimmed;
  const first = base.split(/[\s._-]+/)[0];
  if (!first) return null;

  return first.charAt(0).toLocaleUpperCase("tr") + first.slice(1);
}
