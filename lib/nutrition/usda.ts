import type {
  NutritionProvider,
  NutritionSearchQuery,
  NutritionSearchResult,
} from "@/types/nutrition";

const ENDPOINT = "https://api.nal.usda.gov/fdc/v1/foods/search";
const TIMEOUT_MS = 12_000;

// USDA besin numaraları (nutrientNumber)
const NUTRIENT_ENERGY_KCAL = "208";
const NUTRIENT_PROTEIN = "203";
const NUTRIENT_FAT = "204";
const NUTRIENT_CARB = "205";

type UsdaNutrient = { nutrientNumber?: unknown; value?: unknown };

function readNutrient(nutrients: UsdaNutrient[], number: string): number | null {
  const found = nutrients.find((item) => String(item.nutrientNumber) === number);
  if (!found) return null;
  const value = found.value;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toResult(food: Record<string, unknown>): NutritionSearchResult | null {
  const rawNutrients = food.foodNutrients;
  if (!Array.isArray(rawNutrients)) return null;
  const nutrients = rawNutrients.filter(
    (item): item is UsdaNutrient => typeof item === "object" && item !== null,
  );

  const calories = readNutrient(nutrients, NUTRIENT_ENERGY_KCAL);
  if (calories === null) return null;

  const description = food.description;
  if (typeof description !== "string" || !description) return null;

  const brandOwner = food.brandOwner ?? food.brandName;

  return {
    provider: "usda",
    foodId: String(food.fdcId ?? description),
    name: description,
    brand: typeof brandOwner === "string" && brandOwner ? brandOwner : null,
    // USDA arama sonuçları 100 g bazlıdır.
    per100: {
      caloriesPer100: calories,
      proteinPer100: readNutrient(nutrients, NUTRIENT_PROTEIN) ?? 0,
      carbohydratesPer100: readNutrient(nutrients, NUTRIENT_CARB) ?? 0,
      fatPer100: readNutrient(nutrients, NUTRIENT_FAT) ?? 0,
      basis: "g",
    },
    servingGrams: null,
  };
}

/** USDA FoodData Central — temel/markasız gıdalar için fallback. */
export const usdaProvider: NutritionProvider = {
  name: "usda",

  isConfigured() {
    return (process.env.USDA_API_KEY ?? "").length > 0;
  },

  async search(query: NutritionSearchQuery, signal?: AbortSignal) {
    const apiKey = process.env.USDA_API_KEY ?? "";
    if (!apiKey) return [];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort);

    try {
      const url =
        `${ENDPOINT}?api_key=${encodeURIComponent(apiKey)}` +
        `&query=${encodeURIComponent(query.query)}` +
        `&pageSize=5&dataType=${encodeURIComponent("Foundation,SR Legacy")}`;

      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) return [];

      const data: unknown = await response.json();
      if (typeof data !== "object" || data === null) return [];
      const foods = (data as { foods?: unknown }).foods;
      if (!Array.isArray(foods)) return [];

      return foods
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map(toResult)
        .filter((item): item is NutritionSearchResult => item !== null);
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  },
};
