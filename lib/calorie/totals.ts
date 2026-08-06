import type { FoodEntry, MealType, NutritionTargets } from "@/types/calorie";

export type Totals = {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
};

export const EMPTY_TOTALS: Totals = {
  calories: 0,
  protein: 0,
  carbohydrates: 0,
  fat: 0,
};

/** Yerel saate göre YYYY-MM-DD anahtarı (UTC kaydırması olmadan). */
export function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Bir kaydın ait olduğu yerel gün. */
export function entryDateKey(entry: FoodEntry): string {
  const date = new Date(entry.consumedAt);
  return Number.isNaN(date.getTime()) ? entry.consumedAt.slice(0, 10) : dateKey(date);
}

export function entriesForDate(entries: FoodEntry[], day: string): FoodEntry[] {
  return entries.filter((entry) => entryDateKey(entry) === day);
}

export function sumTotals(entries: FoodEntry[]): Totals {
  return entries.reduce<Totals>(
    (acc, entry) => ({
      calories: acc.calories + entry.calories,
      protein: acc.protein + entry.protein,
      carbohydrates: acc.carbohydrates + entry.carbohydrates,
      fat: acc.fat + entry.fat,
    }),
    { ...EMPTY_TOTALS },
  );
}

export function entriesByMeal(entries: FoodEntry[], meal: MealType): FoodEntry[] {
  return entries.filter((entry) => entry.mealType === meal);
}

export type GoalProgress = {
  consumed: number;
  target: number;
  /** Göstergede kullanılacak, 0-1 arasına sıkıştırılmış oran (taşma yok). */
  ratio: number;
  /** Gerçek yüzde (100'ü aşabilir). */
  percent: number;
  remaining: number;
  isOver: boolean;
  overBy: number;
};

export function goalProgress(consumed: number, target: number): GoalProgress {
  const safeTarget = target > 0 ? target : 0;
  const percent = safeTarget > 0 ? (consumed / safeTarget) * 100 : 0;
  const isOver = safeTarget > 0 && consumed > safeTarget;

  return {
    consumed,
    target: safeTarget,
    ratio: safeTarget > 0 ? Math.min(1, Math.max(0, consumed / safeTarget)) : 0,
    percent,
    remaining: Math.max(0, safeTarget - consumed),
    isOver,
    overBy: isOver ? consumed - safeTarget : 0,
  };
}

export function macroProgressList(totals: Totals, targets: NutritionTargets) {
  return [
    { key: "protein" as const, label: "Protein", value: totals.protein, target: targets.protein },
    {
      key: "carbohydrates" as const,
      label: "Karbonhidrat",
      value: totals.carbohydrates,
      target: targets.carbohydrates,
    },
    { key: "fat" as const, label: "Yağ", value: totals.fat, target: targets.fat },
  ];
}
