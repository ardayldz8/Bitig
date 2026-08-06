import { defaultTargets, type FoodEntry, type NutritionTargets } from "@/types/calorie";

export const ENTRIES_KEY = "bitig.calorie.entries.v1";
export const TARGETS_KEY = "bitig.calorie.targets.v1";

const MEAL_TYPES = new Set(["breakfast", "lunch", "dinner", "snack"]);
const UNITS = new Set(["g", "ml", "piece", "portion"]);
const SOURCES = new Set([
  "fatsecret",
  "open_food_facts",
  "usda",
  "nutrition_label",
  "manual",
]);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function nullableNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isFoodEntry(value: unknown): value is FoodEntry {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;

  return (
    typeof item.id === "string" &&
    item.id.length > 0 &&
    typeof item.name === "string" &&
    (item.brand === null || typeof item.brand === "string") &&
    isFiniteNumber(item.quantity) &&
    typeof item.unit === "string" &&
    UNITS.has(item.unit) &&
    isFiniteNumber(item.calories) &&
    isFiniteNumber(item.protein) &&
    isFiniteNumber(item.carbohydrates) &&
    isFiniteNumber(item.fat) &&
    typeof item.mealType === "string" &&
    MEAL_TYPES.has(item.mealType) &&
    typeof item.source === "string" &&
    SOURCES.has(item.source) &&
    (item.sourceFoodId === null || typeof item.sourceFoodId === "string") &&
    nullableNumber(item.originalCalories) &&
    nullableNumber(item.originalProtein) &&
    nullableNumber(item.originalCarbohydrates) &&
    nullableNumber(item.originalFat) &&
    typeof item.manuallyEdited === "boolean" &&
    nullableNumber(item.confidence) &&
    typeof item.consumedAt === "string" &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string"
  );
}

function isTargets(value: unknown): value is NutritionTargets {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    isFiniteNumber(item.calories) &&
    isFiniteNumber(item.protein) &&
    isFiniteNumber(item.carbohydrates) &&
    isFiniteNumber(item.fat)
  );
}

/** SSR'da çağrılmaz; yalnızca mount sonrası kullanılır. */
export function readEntries(): FoodEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ENTRIES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isFoodEntry);
  } catch {
    return [];
  }
}


export function readTargets(): NutritionTargets {
  if (typeof window === "undefined") return defaultTargets;
  try {
    const raw = window.localStorage.getItem(TARGETS_KEY);
    if (!raw) return defaultTargets;
    const parsed: unknown = JSON.parse(raw);
    return isTargets(parsed) ? parsed : defaultTargets;
  } catch {
    return defaultTargets;
  }
}

