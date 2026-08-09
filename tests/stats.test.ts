import { describe, expect, it } from "vitest";
import { mediaSummary, weeklyReadingPace, yearlySpend } from "@/lib/stats/compute";


describe("okuma hızı", () => {
  const now = new Date("2026-08-08T12:00:00Z");

  it("bölümü kayıt yaşına böler", () => {
    // 140 bölüm, 10 hafta önce eklendi -> haftada 14
    const hiz = weeklyReadingPace(
      [{ name: "a", currentChapter: 140, createdAt: "2026-05-30T12:00:00Z" }],
      now,
    );
    expect(Math.round(hiz!)).toBe(14);
  });

  it("bugün eklenen mangayı saymaz", () => {
    /*
     * "Bugün ekledim, 200 bölümdeyim" haftada 1400 bölüm gibi görünürdü.
     * Kayıt en az bir haftalık olmalı.
     */
    const hiz = weeklyReadingPace(
      [{ name: "a", currentChapter: 200, createdAt: "2026-08-08T09:00:00Z" }],
      now,
    );
    expect(hiz).toBeNull();
  });

  it("tarihi olmayan kaydı atlar", () => {
    expect(weeklyReadingPace([{ name: "a", currentChapter: 50, createdAt: null }], now)).toBeNull();
  });
});

describe("yıllık abonelik gideri", () => {
  it("aylıkları 12 ile çarpar, yıllıkları olduğu gibi alır", () => {
    const toplam = yearlySpend([
      { amount: 100, currency: "TRY", period: "monthly", active: true },
      { amount: 600, currency: "TRY", period: "yearly", active: true },
    ]);
    expect(toplam.get("TRY")).toBe(1800);
  });

  it("pasif aboneliği saymaz", () => {
    const toplam = yearlySpend([
      { amount: 100, currency: "TRY", period: "monthly", active: true },
      { amount: 999, currency: "TRY", period: "monthly", active: false },
    ]);
    expect(toplam.get("TRY")).toBe(1200);
  });

  it("para birimlerini ayrı tutar — kur uydurmaz", () => {
    const toplam = yearlySpend([
      { amount: 10, currency: "USD", period: "monthly", active: true },
      { amount: 100, currency: "TRY", period: "monthly", active: true },
    ]);
    expect(toplam.get("USD")).toBe(120);
    expect(toplam.get("TRY")).toBe(1200);
  });
});

describe("medya özeti", () => {
  it("türe ve duruma göre sayar", () => {
    const o = mediaSummary([
      { mediaType: "series", status: "completed", rating: 9 },
      { mediaType: "movie", status: "completed", rating: 8 },
      { mediaType: "series", status: "watching", rating: null },
      { mediaType: "movie", status: "planned", rating: null },
    ]);

    expect(o.dizi).toBe(2);
    expect(o.film).toBe(2);
    expect(o.tamamlanan).toBe(2);
    expect(o.izleniyor).toBe(1);
    expect(o.planlanan).toBe(1);
  });

  it("puanlanmamış kayıt ortalamayı bozmaz", () => {
    const o = mediaSummary([
      { mediaType: "movie", status: "completed", rating: 10 },
      { mediaType: "movie", status: "planned", rating: null },
      { mediaType: "movie", status: "planned", rating: 0 },
    ]);
    // Yalnızca 10 sayılır; null ve 0 hariç
    expect(o.ortalamaPuan).toBe(10);
  });

  it("hiç puan yoksa null", () => {
    const o = mediaSummary([{ mediaType: "movie", status: "planned", rating: null }]);
    expect(o.ortalamaPuan).toBeNull();
  });
});

