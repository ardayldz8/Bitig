import type { FoodUnit, NutritionPer100 } from "@/types/nutrition";

export type ScaledNutrition = {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
};

/**
 * Miktarı 100 g/ml bazına çevirir.
 * - g / ml doğrudan kullanılır (ml için 1 g/ml yoğunluk varsayılır)
 * - adet / porsiyon için sağlayıcının bildirdiği porsiyon gramı kullanılır
 */
export function toBaseAmount(
  quantity: number,
  unit: FoodUnit,
  servingGrams: number | null,
): number | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  switch (unit) {
    case "g":
    case "ml":
      return quantity;
    case "piece":
    case "portion":
      return servingGrams && servingGrams > 0 ? quantity * servingGrams : null;
  }
}

/**
 * Besin değerlerini porsiyona ölçekler.
 * Yuvarlama YAPMAZ — erken yuvarlama hataları biriktirir; gösterim katmanı yuvarlar.
 */
export function scaleNutrition(
  per100: NutritionPer100,
  baseAmount: number,
): ScaledNutrition {
  return {
    calories: (per100.caloriesPer100 * baseAmount) / 100,
    protein: (per100.proteinPer100 * baseAmount) / 100,
    carbohydrates: (per100.carbohydratesPer100 * baseAmount) / 100,
    fat: (per100.fatPer100 * baseAmount) / 100,
  };
}

/** Arayüzde en fazla bir ondalık basamak gösterilir. */
export function displayNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1).replace(".", ",");
}

/** Binlik ayraçlı tam sayı (ör. 1.840). */
export function displayInteger(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value);
  return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
