import type {
  NutritionProvider,
  NutritionSearchQuery,
  NutritionSearchResult,
} from "@/types/nutrition";

const BASE = "https://world.openfoodfacts.org";
/** Türkiye'de satılan ürünler; adlar da Türkçe geliyor. */
const TR_BASE = "https://tr.openfoodfacts.org";
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

/** Yalnızca ihtiyaç duyulan alanlar — yanıt boyutunu ciddi biçimde küçültür. */
const FIELDS = "code,product_name,product_name_tr,brands,nutriments,serving_quantity,quantity";

/**
 * Kaynak geçici olarak yanıt veremiyor.
 *
 * "Sonuç bulunamadı" ile "servis şu anda kapalı" ayrı şeyler. İkisi aynı
 * gösterilince kullanıcı özelliğin bozuk olduğunu sanıyor; oysa bir dakika
 * sonra çalışacak. Open Food Facts hız sınırında 503 ya da 200 + HTML dönüyor.
 */
export class NutritionUnavailableError extends Error {
  constructor(readonly provider: string) {
    super(`${provider} şu anda yanıt vermiyor`);
    this.name = "NutritionUnavailableError";
  }
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

    // 429/503: hız sınırı ya da bakım. 404 gerçek "yok" cevabıdır.
    if (response.status === 429 || response.status >= 500) {
      throw new NutritionUnavailableError("open_food_facts");
    }
    if (!response.ok) return null;

    // Hız sınırında 200 ile HTML hata sayfası da dönebiliyor.
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) {
      throw new NutritionUnavailableError("open_food_facts");
    }

    return await response.json();
  } catch (error) {
    if (error instanceof NutritionUnavailableError) throw error;
    // Ağ hatası / zaman aşımı da "şu anda erişilemiyor" sayılır
    if (controller.signal.aborted) throw new NutritionUnavailableError("open_food_facts");
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

    const ara = async (base: string): Promise<NutritionSearchResult[]> => {
      const url =
        `${base}/cgi/search.pl?search_terms=${encodeURIComponent(terms)}` +
        `&search_simple=1&action=process&json=1&page_size=5&lc=tr&fields=${FIELDS}`;

      const data = await fetchJson(url, signal);
      if (typeof data !== "object" || data === null) return [];
      const products = (data as { products?: unknown }).products;
      if (!Array.isArray(products)) return [];

      return products
        .filter(
          (item): item is Record<string, unknown> =>
            typeof item === "object" && item !== null,
        )
        .map(toResult)
        .filter((item): item is NutritionSearchResult => item !== null);
    };

    // Önce Türkiye dizini: kullanıcı Türkiye'de yaşıyor, aradığı ürünler
    // burada satılanlar. Dünya dizini ABD/AB ağırlıklı sonuç döndürüyor ve
    // "mercimek çorbası" gibi aramalarda alakasız eşleşme veriyor.
    const yerel = await ara(TR_BASE);
    if (yerel.length > 0) return yerel;

    // Türkiye dizininde yoksa dünya dizinine düş — evrensel besinler orada.
    return ara(BASE);
  },

  async getByBarcode(barcode: string, signal?: AbortSignal) {
    const url = `${BASE}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`;
    const data = await fetchJson(url, signal);
    if (typeof data !== "object" || data === null) return null;

    const record = data as { status?: unknown; product?: unknown };
    if (record.status !== 1) return null;
    if (typeof record.product !== "object" || record.product === null) return null;

    return toResult(record.product as Record<string, unknown>);
  },
};
