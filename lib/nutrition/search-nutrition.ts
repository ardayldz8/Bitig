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
  const chain = providerChain({ kind: input.kind, hasBarcode: Boolean(input.barcode) });

  // 1) Barkod varsa önce doğrudan barkod aramasını dene
  if (input.barcode) {
    for (const name of chain) {
      const provider = getProvider(name);
      if (!provider.isConfigured() || !provider.getByBarcode) continue;
      const found = await provider.getByBarcode(input.barcode, signal);
      if (found) return found;
    }
  }

  // 2) Metin sorgularıyla zinciri sırayla dene
  const queries = input.queries.filter((query) => query.trim().length > 0).slice(0, 3);
  if (queries.length === 0) return null;

  for (const name of chain) {
    const provider = getProvider(name);
    if (!provider.isConfigured()) continue;

    for (const query of queries) {
      const results = await provider.search(
        { query, brand: input.brand, kind: input.kind },
        signal,
      );
      const best = pickBest(results);
      if (best) return best;
    }
  }

  return null;
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
      if (found) return found;
    } else {
      // Barkod endpoint'i yoksa ürün kodunu metin olarak ara
      const results = await provider.search({ query: barcode }, signal);
      const best = pickBest(results);
      if (best) return best;
    }
  }

  return null;
}

/** Kalorisi sıfır olmayan ilk makul sonucu seçer. */
function pickBest(results: NutritionSearchResult[]): NutritionSearchResult | null {
  return results.find((item) => item.per100.caloriesPer100 > 0) ?? null;
}
