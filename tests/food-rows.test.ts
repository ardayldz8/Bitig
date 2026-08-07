import { describe, expect, it } from "vitest";
import { buildRow, recalcRow } from "@/lib/calorie/rows";
import type { ResolvedNutrition } from "@/types/calorie";

/** 100 g bazlı, porsiyon ağırlığı bilinmeyen kaynak (USDA'da yaygın). */
const gramBazli: ResolvedNutrition = {
  source: "usda",
  foodId: "1",
  name: "Bread, white wheat",
  brand: null,
  caloriesPer100: 238,
  proteinPer100: 8,
  carbohydratesPer100: 45,
  fatPer100: 3,
  basis: "g",
  servingGrams: null,
};

/** Porsiyon ağırlığı bildiren kaynak. */
const porsiyonlu: ResolvedNutrition = { ...gramBazli, servingGrams: 30 };

const item = (unit: "g" | "piece" | "unknown", quantity: number | null) => ({
  name: "beyaz ekmek",
  brand: null,
  estimatedQuantity: quantity,
  unit,
  confidence: 0.9,
  searchQueries: ["white bread"],
});

describe("miktar birimi çevrilemediğinde", () => {
  it("değerleri sıfır bırakmaz, işaretler", () => {
    // "iki dilim ekmek": kaynak 100 g üzerinden veri veriyor ama bir dilimin
    // kaç gram olduğu bilinmiyor. Sıfır göstermek, gerçekten 0 kalorili bir
    // yiyecekten ayırt edilemez.
    const row = buildRow(item("piece", 2), gramBazli);

    expect(row.needsQuantity).toBe(true);
    expect(row.calories).toBe(0);
  });

  it("porsiyon ağırlığı biliniyorsa hesaplar", () => {
    const row = buildRow(item("piece", 2), porsiyonlu);

    expect(row.needsQuantity).toBe(false);
    // 2 dilim × 30 g = 60 g → 238 × 0,6
    expect(Math.round(row.calories)).toBe(143);
  });

  it("gram girilince uyarı kalkar ve değerler hesaplanır", () => {
    const row = buildRow(item("piece", 2), gramBazli);
    expect(row.needsQuantity).toBe(true);

    const duzeltilmis = recalcRow(row, { quantity: 60, unit: "g" });

    expect(duzeltilmis.needsQuantity).toBe(false);
    expect(Math.round(duzeltilmis.calories)).toBe(143);
  });

  it("gramdan tekrar adete dönülürse yeniden işaretlenir", () => {
    const row = recalcRow(buildRow(item("g", 60), gramBazli), {
      quantity: 2,
      unit: "piece",
    });

    expect(row.needsQuantity).toBe(true);
  });

  it("kaynak yoksa işaretlenmez — zaten manuel giriş isteniyor", () => {
    const row = buildRow(item("piece", 2), null);

    expect(row.match).toBeNull();
    expect(row.needsQuantity).toBe(false);
  });

  it("gram bazlı miktarda sorun yok", () => {
    const row = buildRow(item("g", 100), gramBazli);

    expect(row.needsQuantity).toBe(false);
    expect(Math.round(row.calories)).toBe(238);
  });

  it("miktar belirtilmemişse makul bir varsayılan kullanır", () => {
    // Model miktar uydurmuyor; arayüz 100 g ile başlatıp kullanıcıya bırakıyor
    const row = buildRow(item("g", null), gramBazli);

    expect(row.quantity).toBe(100);
    expect(Math.round(row.calories)).toBe(238);
  });
});

describe("elle düzenleme", () => {
  it("makroya dokunulunca kaynak değerleri korunur", () => {
    const row = buildRow(item("g", 100), gramBazli);
    const duzenlenmis = recalcRow(row, { calories: 500 });

    expect(duzenlenmis.manuallyEdited).toBe(true);
    expect(duzenlenmis.calories).toBe(500);
    // Kaydedilen kayıtta sağlayıcının orijinal değeri kaybolmamalı
    expect(Math.round(duzenlenmis.originalCalories ?? 0)).toBe(238);
  });
});
