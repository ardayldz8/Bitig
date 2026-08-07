import { describe, expect, it } from "vitest";
import {
  daysUntil,
  formatAmount,
  monthlyTotal,
  nextDueDate,
  type Subscription,
} from "@/lib/subscriptions/calc";

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

const abonelik = (over: Partial<Subscription> = {}): Subscription => ({
  id: "s1",
  name: "Netflix",
  amount: 200,
  currency: "TRY",
  startedOn: "2026-01-15",
  period: "monthly",
  active: true,
  notes: null,
  ...over,
});

describe("sonraki ödeme günü", () => {
  /*
   * Bu vakalar veritabanındaki public.next_due_date ile birebir aynı;
   * iki taraf ayrışırsa arayüzde görünen tarih ile bildirimin gittiği
   * tarih birbirini tutmaz.
   */
  it("ay ortasında sonraki ödemeyi bulur", () => {
    expect(iso(nextDueDate("2026-01-15", "monthly", new Date("2026-08-07")))).toBe("2026-08-15");
  });

  it("bugün ödeme günüyse bugünü döner", () => {
    expect(iso(nextDueDate("2026-01-07", "monthly", new Date("2026-08-07")))).toBe("2026-08-07");
  });

  it("gün geçtiyse sonraki aya atlar", () => {
    expect(iso(nextDueDate("2026-01-05", "monthly", new Date("2026-08-07")))).toBe("2026-09-05");
  });

  it("kısa ayda ayın son gününe sığdırır", () => {
    expect(iso(nextDueDate("2026-01-31", "monthly", new Date("2026-02-01")))).toBe("2026-02-28");
  });

  it("kısa aydan sonra KAYMAZ — mart yine 31", () => {
    // Ardışık toplama yapılsaydı 28 Mart olurdu ve abonelik kalıcı kayardı
    expect(iso(nextDueDate("2026-01-31", "monthly", new Date("2026-03-01")))).toBe("2026-03-31");
  });

  it("yıllık abonelik", () => {
    expect(iso(nextDueDate("2024-03-20", "yearly", new Date("2026-08-07")))).toBe("2027-03-20");
  });

  it("gelecekte başlayan abonelik başlangıcını döner", () => {
    expect(iso(nextDueDate("2026-12-01", "monthly", new Date("2026-08-07")))).toBe("2026-12-01");
  });

  it("bozuk tarihte null — uydurma tarih üretilmez", () => {
    expect(nextDueDate("", "monthly", new Date("2026-08-07"))).toBeNull();
  });
});

describe("kalan gün", () => {
  it("bildirim eşiklerini doğru sayar", () => {
    const ref = new Date("2026-08-07");
    expect(daysUntil(new Date("2026-08-14"), ref)).toBe(7);
    expect(daysUntil(new Date("2026-08-10"), ref)).toBe(3);
    expect(daysUntil(new Date("2026-08-08"), ref)).toBe(1);
    expect(daysUntil(new Date("2026-08-07"), ref)).toBe(0);
  });
});

describe("aylık toplam", () => {
  it("yıllık aboneliği 12'ye böler", () => {
    /*
     * "Aylık ne ödüyorum" sorusunun cevabı, yıllık ödemenin düştüğü ay
     * 1200 ₺ diğer aylar 0 ₺ değil; sürekli 100 ₺'dir.
     */
    const toplam = monthlyTotal([
      abonelik({ amount: 200, period: "monthly" }),
      abonelik({ id: "s2", amount: 1200, period: "yearly" }),
    ]);

    expect(toplam.get("TRY")).toBe(300);
  });

  it("pasif abonelik sayılmaz", () => {
    const toplam = monthlyTotal([
      abonelik({ amount: 200 }),
      abonelik({ id: "s2", amount: 500, active: false }),
    ]);

    expect(toplam.get("TRY")).toBe(200);
  });

  it("para birimleri ayrı toplanır — kur uydurulmaz", () => {
    const toplam = monthlyTotal([
      abonelik({ amount: 200, currency: "TRY" }),
      abonelik({ id: "s2", amount: 10, currency: "USD" }),
    ]);

    expect(toplam.get("TRY")).toBe(200);
    expect(toplam.get("USD")).toBe(10);
  });
});

describe("tutar biçimi", () => {
  it("bilinen para birimine simge koyar", () => {
    expect(formatAmount(200, "TRY")).toBe("200 ₺");
    expect(formatAmount(9.99, "USD")).toBe("9,99 $");
  });

  it("bilinmeyen para biriminde kodu yazar", () => {
    expect(formatAmount(50, "JPY")).toBe("50 JPY");
  });
});
