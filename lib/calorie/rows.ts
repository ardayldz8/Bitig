import { scaleNutrition, toBaseAmount } from "@/lib/nutrition/calculate-nutrition";
import { createId } from "@/lib/ids";
import type { DetectedFood, ResolvedNutrition } from "@/types/calorie";
import type { FoodUnit } from "@/types/nutrition";

/**
 * Analiz satırlarının hesap mantığı.
 *
 * React'ten ayrı tutuldu: saf fonksiyonlar ve doğrudan test edilebilmeleri
 * gerekiyor. Hook içinde kaldıklarında test dosyası dolaylı olarak JSX'e
 * bağımlı hâle geliyordu.
 */

/** Modelden gelen, henüz besin değeriyle eşleştirilmemiş yiyecek. */
export type DetectedItem = {
  name: string;
  brand: string | null;
  estimatedQuantity: number | null;
  unit: FoodUnit | "unknown";
  confidence: number;
  searchQueries: string[];
};

export function buildRow(
  item: DetectedItem,
  match: ResolvedNutrition | null,
): DetectedFood {
  const unit: FoodUnit = item.unit === "unknown" ? (match ? match.basis : "g") : item.unit;
  const quantity =
    item.estimatedQuantity && item.estimatedQuantity > 0
      ? item.estimatedQuantity
      : unit === "piece" || unit === "portion"
        ? 1
        : 100;

  const base = match ? toBaseAmount(quantity, unit, match.servingGrams) : null;
  const scaled =
    match && base !== null
      ? scaleNutrition(
          {
            caloriesPer100: match.caloriesPer100,
            proteinPer100: match.proteinPer100,
            carbohydratesPer100: match.carbohydratesPer100,
            fatPer100: match.fatPer100,
            basis: match.basis,
          },
          base,
        )
      : { calories: 0, protein: 0, carbohydrates: 0, fat: 0 };

  return {
    rowId: createId(),
    // Kaynak var ama miktarı onun birimine çeviremedik: değerler 0 kalır ve
    // bu gerçekten 0 kalorili bir yiyecekten ayırt edilemez. İşaretlenir.
    needsQuantity: match !== null && base === null,
    name: match?.name ?? item.name,
    brand: match?.brand ?? item.brand,
    quantity,
    unit,
    match,
    ...scaled,
    originalCalories: match ? scaled.calories : null,
    originalProtein: match ? scaled.protein : null,
    originalCarbohydrates: match ? scaled.carbohydrates : null,
    originalFat: match ? scaled.fat : null,
    confidence: item.confidence,
    manuallyEdited: false,
  };
}

/** Miktar değişince besin değerleri kaynaktan yeniden hesaplanır. */
export function recalcRow(
  row: DetectedFood,
  patch: Partial<DetectedFood>,
): DetectedFood {
  const next: DetectedFood = { ...row, ...patch };

  const quantityChanged = patch.quantity !== undefined || patch.unit !== undefined;
  const macrosTouched =
    patch.calories !== undefined ||
    patch.protein !== undefined ||
    patch.carbohydrates !== undefined ||
    patch.fat !== undefined;

  // Elle düzenlemede orijinal (kaynak) değerlere DOKUNULMAZ
  if (macrosTouched) {
    return { ...next, manuallyEdited: true };
  }

  if (quantityChanged && next.match) {
    const base = toBaseAmount(next.quantity, next.unit, next.match.servingGrams);
    next.needsQuantity = base === null;

    if (base !== null) {
      const scaled = scaleNutrition(
        {
          caloriesPer100: next.match.caloriesPer100,
          proteinPer100: next.match.proteinPer100,
          carbohydratesPer100: next.match.carbohydratesPer100,
          fatPer100: next.match.fatPer100,
          basis: next.match.basis,
        },
        base,
      );
      // Miktar değişti: hem gösterilen hem orijinal değer kaynaktan tazelenir
      return {
        ...next,
        ...scaled,
        originalCalories: scaled.calories,
        originalProtein: scaled.protein,
        originalCarbohydrates: scaled.carbohydrates,
        originalFat: scaled.fat,
      };
    }
  }

  return next;
}
