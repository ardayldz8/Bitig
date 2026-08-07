import { NutritionUnavailableError } from "@/lib/nutrition/unavailable";
import type {
  FoodKind,
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

/**
 * Hangi USDA veri setlerinde aranacağı.
 *
 * Foundation ve SR Legacy ham maddeye odaklı; PİŞMİŞ ve KARIŞIK yemekler
 * yalnızca Survey (FNDDS) setinde var. Bu set dışarıda bırakıldığı için
 * "pilav" araması kuru pilav karışımı (359 kcal), "mercimek çorbası" araması
 * hazır çorba döndürüyordu. FNDDS ile: "Rice pilaf" 137 kcal, "Soup, lentil"
 * 60 kcal, "Eggplant and meat casserole" (musakka/karnıyarık) 96 kcal.
 */
function veriSetleri(kind: FoodKind | undefined): string {
  // Tabak yemeği aranıyorsa hazır yemek seti başa gelmeli.
  if (kind === "turkish_or_restaurant") return "Survey (FNDDS),SR Legacy";

  /*
   * Ham maddede de FNDDS gerekiyor: "oats" araması Foundation/SR Legacy'de
   * yalnızca kepek ve yağ döndürürken FNDDS "Oats, raw" (379 kcal) veriyor.
   *
   * FNDDS'in pişmiş yemek kayıtlarının ("Egg, Benedict") ham madde aramasını
   * çalma riski, ilgililik puanındaki bütün-gıda ödülüyle karşılanıyor:
   * "Eggs, Grade A, Large, egg whole" 0,965 alırken "Egg, Benedict" 0,963'te
   * kalıyor.
   */
  return "Foundation,SR Legacy,Survey (FNDDS)";
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
        // 5 aday sıralayıcıyı aç bırakıyordu: "oats" için doğru kayıt ilk
        // beşte değil. Tek istek, daha geniş liste.
        `&pageSize=15&dataType=${encodeURIComponent(veriSetleri(query.kind))}`;

      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      /*
       * Sessizce [] dönmek, hız sınırını "sonuç yok" gibi gösteriyordu: zincir
       * bir sonraki kaynağa düşüyor ve "yumurta" araması paketli ürün
       * veritabanından "Egg Noodle" (339 kcal) döndürüyordu. api.data.gov hız
       * sınırında 429 ya da 400 + HTML veriyor; ikisi de geçici.
       */
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new NutritionUnavailableError("usda");
      }

      const data: unknown = await response.json();
      if (typeof data !== "object" || data === null) return [];
      const foods = (data as { foods?: unknown }).foods;
      if (!Array.isArray(foods)) return [];

      return foods
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map(toResult)
        .filter((item): item is NutritionSearchResult => item !== null);
    } catch (error) {
      if (error instanceof NutritionUnavailableError) throw error;
      // Ağ hatası / zaman aşımı da "şu anda erişilemiyor" sayılır
      if (controller.signal.aborted) throw new NutritionUnavailableError("usda");
      return [];
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  },
};
