import { NutritionUnavailableError } from "@/lib/nutrition/open-food-facts";
import { isPlausible } from "@/lib/nutrition/plausibility";
import { getProvider, providerChain } from "@/lib/nutrition/provider";
import type {
  FoodKind,
  NutritionSearchResult,
  NutritionProviderName,
} from "@/types/nutrition";

/**
 * Bir yiyecek için izin verilen kaynaklarda sırayla arama yapar.
 * İlk sonuç veren kaynak kazanır; hiçbiri sonuç vermezse null döner
 * (bu durumda AI kalori UYDURMAZ, kullanıcı manuel girer).
 */
export async function resolveNutrition(
  input: {
    queries: string[];
    brand: string | null;
    barcode: string | null;
    kind: FoodKind;
  },
  signal?: AbortSignal,
): Promise<NutritionSearchResult | null> {
  const { result } = await resolveNutritionDetailed(input, signal);
  return result;
}

/**
 * Sonucun yanında "kaynak erişilemedi mi" bilgisini de döner.
 *
 * Erişilemezlik sessizce "bulunamadı"ya çevrilirse kullanıcı özelliğin bozuk
 * olduğunu sanır; oysa hız sınırı birkaç dakikada açılıyor.
 */
export async function resolveNutritionDetailed(
  input: {
    queries: string[];
    brand: string | null;
    barcode: string | null;
    kind: FoodKind;
  },
  signal?: AbortSignal,
): Promise<{ result: NutritionSearchResult | null; unavailable: boolean }> {
  const chain = providerChain({ kind: input.kind, hasBarcode: Boolean(input.barcode) });
  let unavailable = false;

  /** Bir kaynağın çökmesi zinciri durdurmasın; sıradaki denensin. */
  const guard = async <T>(run: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await run();
    } catch (error) {
      if (error instanceof NutritionUnavailableError) {
        unavailable = true;
        return fallback;
      }
      throw error;
    }
  };

  // 1) Barkod varsa önce doğrudan barkod aramasını dene
  if (input.barcode) {
    for (const name of chain) {
      const provider = getProvider(name);
      if (!provider.isConfigured() || !provider.getByBarcode) continue;
      const found = await guard(
        () => provider.getByBarcode!(input.barcode!, signal),
        null,
      );
      // Barkod eşleşmesi de makul olmalı: kaynaktaki hatalı kayıt, ürün doğru
      // bulunduğu için daha da inandırıcı görünür.
      if (found && isPlausible(found.per100)) return { result: found, unavailable };
    }
  }

  // 2) Metin sorgularıyla zinciri sırayla dene
  const queries = input.queries.filter((query) => query.trim().length > 0).slice(0, 3);
  if (queries.length === 0) return { result: null, unavailable };

  for (const name of chain) {
    const provider = getProvider(name);
    if (!provider.isConfigured()) continue;

    for (const query of queries) {
      const results = await guard(
        () => provider.search({ query, brand: input.brand, kind: input.kind }, signal),
        [] as NutritionSearchResult[],
      );
      const best = pickBest(results);
      if (best) return { result: best, unavailable };
    }
  }

  return { result: null, unavailable };
}

/** Barkod için özel, kısa zincir (barkod endpoint'i tarafından kullanılır). */
export async function resolveByBarcode(
  barcode: string,
  signal?: AbortSignal,
): Promise<NutritionSearchResult | null> {
  const chain: NutritionProviderName[] = ["open_food_facts", "fatsecret"];

  for (const name of chain) {
    const provider = getProvider(name);
    if (!provider.isConfigured()) continue;

    if (provider.getByBarcode) {
      const found = await provider.getByBarcode(barcode, signal);
      if (found && isPlausible(found.per100)) return found;
    } else {
      // Barkod endpoint'i yoksa ürün kodunu metin olarak ara
      const results = await provider.search({ query: barcode }, signal);
      const best = pickBest(results);
      if (best) return best;
    }
  }

  return null;
}

/**
 * Kalorisi sıfır olmayan ve fiziksel olarak mümkün ilk sonucu seçer.
 *
 * Kaynaklar topluluk verisi içeriyor; "rice" araması 1900 kcal/100 g döndüren
 * bir kayda denk gelebiliyor. Böyle bir değeri göstermek, kalori uydurmakla
 * aynı sonucu doğurur.
 */
function pickBest(results: NutritionSearchResult[]): NutritionSearchResult | null {
  return (
    results.find((item) => item.per100.caloriesPer100 > 0 && isPlausible(item.per100)) ??
    null
  );
}
