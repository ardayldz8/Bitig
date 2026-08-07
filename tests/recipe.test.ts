import { describe, expect, it } from "vitest";
import {
  recipePer100,
  recipeTotals,
  totalGramsWarning,
  type RecipeIngredient,
} from "@/lib/calorie/recipe";

const malzeme = (
  name: string,
  grams: number,
  kcal: number,
  p = 0,
  k = 0,
  y = 0,
): RecipeIngredient => ({
  id: name,
  recipeId: "r1",
  name,
  grams,
  caloriesPer100: kcal,
  proteinPer100: p,
  carbohydratesPer100: k,
  fatPer100: y,
  source: "usda",
});

/** Gerçekçi bir karnıyarık: hiçbir besin veritabanında bulunamayan yemek. */
const KARNIYARIK = [
  malzeme("patlıcan", 600, 25, 1, 6, 0.2),
  malzeme("kıyma", 300, 250, 17, 0, 20),
  malzeme("soğan", 150, 40, 1.1, 9, 0.1),
  malzeme("zeytinyağı", 60, 884, 0, 0, 100),
  malzeme("domates", 200, 18, 0.9, 3.9, 0.2),
];

describe("tarif toplamı", () => {
  it("malzemeleri gramlarına göre toplar", () => {
    const t = recipeTotals(KARNIYARIK);

    // 150 + 750 + 60 + 530,4 + 36
    expect(Math.round(t.calories)).toBe(1526);
    expect(t.ingredientGrams).toBe(1310);
  });

  it("boş tarif sıfır döner", () => {
    const t = recipeTotals([]);
    expect(t.calories).toBe(0);
    expect(t.ingredientGrams).toBe(0);
  });
});

describe("pişmiş ağırlığa göre 100 g değeri", () => {
  it("pişme kaybını hesaba katar", () => {
    /*
     * 1310 g malzeme pişince 1000 g'a düşüyor. Malzeme toplamına bölmek
     * 100 g'ı 117 kcal gösterirdi; oysa su uçtuğu için yemek daha yoğun.
     */
    const per100 = recipePer100(KARNIYARIK, 1000);

    expect(per100).not.toBeNull();
    expect(Math.round(per100!.caloriesPer100)).toBe(153);
  });

  it("aynı tarif daha az su kaybederse 100 g'ı daha hafif olur", () => {
    const yogun = recipePer100(KARNIYARIK, 800)!;
    const seyreltik = recipePer100(KARNIYARIK, 1200)!;

    expect(yogun.caloriesPer100).toBeGreaterThan(seyreltik.caloriesPer100);
  });

  it("malzeme yoksa ya da ağırlık sıfırsa null — uydurma değer üretilmez", () => {
    expect(recipePer100([], 1000)).toBeNull();
    expect(recipePer100(KARNIYARIK, 0)).toBeNull();
  });

  it("makrolar da aynı oranla ölçeklenir", () => {
    const per100 = recipePer100(KARNIYARIK, 1000)!;
    // kıymadan 51 g + soğandan 1.65 + patlıcandan 6 + domatesten 1.8
    expect(Math.round(per100.proteinPer100)).toBe(6);
  });
});

describe("pişmiş ağırlık uyarısı", () => {
  it("makul kayıpta uyarmaz", () => {
    expect(totalGramsWarning(1310, 1000)).toBeNull();
  });

  it("makul kazançta uyarmaz — pilav su çeker", () => {
    expect(totalGramsWarning(400, 900)).toBeNull();
  });

  it("bir basamak eksik yazılırsa uyarır", () => {
    // 900 yerine 90: kaloriyi on kat şişirir ve sessizce her öğüne yansır
    expect(totalGramsWarning(1310, 90)).toMatch(/yarısından az/);
  });

  it("aşırı büyük değerde uyarır", () => {
    expect(totalGramsWarning(400, 5000)).toMatch(/iki katından fazla/);
  });

  it("eksik veride uyarı üretmez", () => {
    expect(totalGramsWarning(0, 1000)).toBeNull();
    expect(totalGramsWarning(1000, 0)).toBeNull();
  });
});
