export type SubscriptionPeriod = "monthly" | "yearly";

export type Subscription = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  /** İlk ödeme tarihi (YYYY-MM-DD). Sonraki ödemeler buradan türetilir. */
  startedOn: string;
  period: SubscriptionPeriod;
  active: boolean;
  notes: string | null;
};

/**
 * Verilen tarihte ya da sonrasındaki ilk ödeme günü.
 *
 * Hesap HER ZAMAN başlangıçtan yapılıyor, bir önceki ödemeden değil. Ardışık
 * toplamada ay sonları kayıyor: 31 Ocak + 1 ay = 28 Şubat, ondan +1 ay = 28
 * Mart… ve abonelik ayın 31'i yerine 28'ine kaymış oluyor. Başlangıçtan n ay
 * eklemek her seferinde doğru güne sabitliyor.
 *
 * Aynı mantık veritabanında da var (public.next_due_date); orası bildirim
 * gönderimi için, burası arayüzde göstermek için.
 */
export function nextDueDate(startedOn: string, period: SubscriptionPeriod, ref: Date): Date | null {
  const [y, m, d] = startedOn.split("-").map(Number);
  if (!y || !m || !d) return null;

  const adim = period === "yearly" ? 12 : 1;
  const gecenAy =
    (ref.getFullYear() - y) * 12 + (ref.getMonth() + 1 - m);
  const n = Math.max(0, Math.floor(gecenAy / adim));

  const uret = (kac: number) => {
    const tarih = new Date(Date.UTC(y, m - 1 + kac * adim, 1));
    // Ayın son gününü aşarsa o aya sığdır (31 Ocak → 28 Şubat)
    const sonGun = new Date(Date.UTC(tarih.getUTCFullYear(), tarih.getUTCMonth() + 1, 0)).getUTCDate();
    tarih.setUTCDate(Math.min(d, sonGun));
    return tarih;
  };

  const aday = uret(n);
  const bugun = new Date(Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate()));
  return aday >= bugun ? aday : uret(n + 1);
}

/** Ödemeye kaç gün kaldığı. Bugünse 0. */
export function daysUntil(due: Date, ref: Date): number {
  const a = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const b = Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate());
  return Math.round((a - b) / 86_400_000);
}

/**
 * Aylık toplam gider.
 *
 * Yıllık abonelikler 12'ye bölünüyor: "aylık ne kadar ödüyorum" sorusunun
 * cevabı, yıllık ödemenin geldiği ay 1200 ₺ diğer aylar 0 ₺ değil, sürekli
 * 100 ₺'dir. Pasif abonelikler sayılmaz.
 */
export function monthlyTotal(subscriptions: Subscription[]): Map<string, number> {
  const toplam = new Map<string, number>();
  for (const item of subscriptions) {
    if (!item.active) continue;
    const aylik = item.period === "yearly" ? item.amount / 12 : item.amount;
    toplam.set(item.currency, (toplam.get(item.currency) ?? 0) + aylik);
  }
  return toplam;
}

export function formatAmount(amount: number, currency: string): string {
  const simge: Record<string, string> = { TRY: "₺", USD: "$", EUR: "€", GBP: "£" };
  const sayi = amount.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
  return simge[currency] ? `${sayi} ${simge[currency]}` : `${sayi} ${currency}`;
}
