import { describe, expect, it } from "vitest";
import { checkPlausibility, isPlausible } from "@/lib/nutrition/plausibility";
import type { NutritionPer100 } from "@/types/nutrition";

const per100 = (
  calories: number,
  protein: number,
  carbohydrates: number,
  fat: number,
): NutritionPer100 => ({
  caloriesPer100: calories,
  proteinPer100: protein,
  carbohydratesPer100: carbohydrates,
  fatPer100: fat,
  basis: "g",
});

describe("besin değeri makullük kontrolü", () => {
  it("gerçek yiyecekleri kabul eder", () => {
    // Nutella: kaynaktan gelen gerçek değerler
    expect(isPlausible(per100(539, 6.3, 57.5, 30.9))).toBe(true);
    // Haşlanmış pirinç
    expect(isPlausible(per100(130, 2.7, 28, 0.3))).toBe(true);
    // Zeytinyağı — üst sınıra en yakın gerçek yiyecek
    expect(isPlausible(per100(884, 0, 0, 100))).toBe(true);
    // Su / kalorisiz içecek
    expect(isPlausible(per100(0, 0, 0, 0))).toBe(true);
  });

  it("imkânsız kaloriyi eler", () => {
    // Gerçek hata: "rice" araması bu değeri döndürdü (kJ, kcal alanına yazılmış)
    const sonuc = checkPlausibility(per100(1900, 8, 77, 3));
    expect(sonuc.ok).toBe(false);
    if (!sonuc.ok) expect(sonuc.reason).toContain("kalori");
  });

  it("100 gramda 100 gramdan fazla makro kabul etmez", () => {
    expect(isPlausible(per100(500, 60, 60, 20))).toBe(false);
    expect(isPlausible(per100(400, 120, 0, 0))).toBe(false);
  });

  it("büyüklük mertebesi uyuşmazlığını eler", () => {
    // Makrolar ~370 kcal'e denk ama kayıt 50 diyor — 7 kat sapma
    expect(isPlausible(per100(50, 20, 50, 10))).toBe(false);
  });

  it("meşru sapmalara dokunmaz", () => {
    // Alkol makro listesinde yok; kalori makrolardan yüksek çıkar (votka)
    expect(isPlausible(per100(231, 0, 0, 0))).toBe(true);
    // Lif karbonhidrata yazılır ama kalori vermez (kepek)
    expect(isPlausible(per100(216, 15.5, 64.5, 4.3))).toBe(true);
  });

  it("makro bildirilmemişse yalnızca kaloriye bakar", () => {
    // Bazı kayıtlarda makro yok; bu tek başına hata değil
    expect(isPlausible(per100(250, 0, 0, 0))).toBe(true);
  });

  it("negatif ve geçersiz değerleri eler", () => {
    expect(isPlausible(per100(-10, 0, 0, 0))).toBe(false);
    expect(isPlausible(per100(100, -5, 10, 2))).toBe(false);
    expect(isPlausible(per100(Number.NaN, 0, 0, 0))).toBe(false);
    expect(isPlausible(per100(Number.POSITIVE_INFINITY, 0, 0, 0))).toBe(false);
  });

  it("lif ve poliol sapmasına tolerans gösterir", () => {
    // Yüksek lifli kepek: lif karbonhidrata yazılır ama tam 4 kcal/g vermez
    expect(isPlausible(per100(230, 16, 65, 4))).toBe(true);
  });
});
