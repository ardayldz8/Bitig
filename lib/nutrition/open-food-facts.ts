import type {
  NutritionProvider,
  NutritionSearchQuery,
  NutritionSearchResult,
} from "@/types/nutrition";

const BASE = "https://world.openfoodfacts.org";
const USER_AGENT = "Bitig/0.1 (kalori takibi)";
const TIMEOUT_MS = 12_000;

type OffNutriments = Record<string, unknown>;

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/** OFF bazen kcal vermez, yalnızca kJ verir → kcal'e çevir. */
function readCalories(nutriments: OffNutriments): number | null {
  const kcal = num(nutriments["energy-kcal_100g"]);
  if (kcal !== null) return kcal;
  const kj = num(nutriments["energy_100g"]) ?? num(nutriments["energy-kj_100g"]);
  return kj === null ? null : kj / 4.184;
}

function toResult(product: Record<string, unknown>): NutritionSearchResult | null {
  const nutriments = (product.nutriments ?? {}) as OffNutriments;
  const calories = readCalories(nutriments);
  if (calories === null) return null;

  const name =
    (typeof product.product_name_tr === "string" && product.product_name_tr) ||
    (typeof product.product_name === "string" && product.product_name) ||
    null;
  if (!name) return null;

  const isDrink = typeof product.quantity === "string" && /\bml\b|litre|lt\b/i.test(product.quantity);
  const servingGrams = num(product.serving_quantity);

  return {
    provider: "open_food_facts",
    foodId: String(product.code ?? product._id ?? name),
    name,
    brand: typeof product.brands === "string" && product.brands ? product.brands : null,
    per100: {
      caloriesPer100: calories,
      proteinPer100: num(nutriments["proteins_100g"]) ?? 0,
      carbohydratesPer100: num(nutriments["carbohydrates_100g"]) ?? 0,
      fatPer100: num(nutriments["fat_100g"]) ?? 0,
      basis: isDrink ? "ml" : "g",
    },
    servingGrams: servingGrams !== null && servingGrams > 0 ? servingGrams : null,
  };
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/** Open Food Facts — anahtar gerektirmez, barkodlu/paketli ürünlerde birincildir. */
export const openFoodFactsProvider: NutritionProvider = {
  name: "open_food_facts",

  isConfigured() {
    return true; // API anahtarı gerekmiyor
  },

  async search(query: NutritionSearchQuery, signal?: AbortSignal) {
    const terms = [query.brand, query.query].filter(Boolean).join(" ");
    const url =
      `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(terms)}` +
      `&search_simple=1&action=process&json=1&page_size=5`;

    const data = await fetchJson(url, signal);
    if (typeof data !== "object" || data === null) return [];
    const products = (data as { products?: unknown }).products;
    if (!Array.isArray(products)) return [];

    return products
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map(toResult)
      .filter((item): item is NutritionSearchResult => item !== null);
  },

  async getByBarcode(barcode: string, signal?: AbortSignal) {
    const url = `${BASE}/api/v2/product/${encodeURIComponent(barcode)}.json`;
    const data = await fetchJson(url, signal);
    if (typeof data !== "object" || data === null) return null;

    const record = data as { status?: unknown; product?: unknown };
    if (record.status !== 1) return null;
    if (typeof record.product !== "object" || record.product === null) return null;

    return toResult(record.product as Record<string, unknown>);
  },
};
