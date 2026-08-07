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
      const best = pickBest(results, query);
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
      const best = pickBest(results, barcode);
      if (best) return best;
    }
  }

  return null;
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((word) => word.length > 1);
}

/** Tekil/çoğul farkını yutan gevşek eşleşme ("oat" ↔ "oats"). */
function benzer(a: string, b: string): boolean {
  if (a === b) return true;
  return a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a));
}

/**
 * Sonucun sorguyla ne kadar ilgili olduğu (0–1).
 *
 * Baş kelime ağırlıklı: USDA açıklamaları "Yiyecek, niteleyici, niteleyici"
 * biçiminde ve ayırt edici olan ilk kelime. "oats" araması "Oil, oat" (yulaf
 * YAĞI, 884 kcal) sonucunu ilk sırada döndürüyordu — değer makul olduğu için
 * makullük filtresi yakalayamıyor, yanlış olan yiyeceğin kendisi.
 */
export function relevance(query: string, name: string): number {
  const q = tokens(query);
  const n = tokens(name);
  if (q.length === 0 || n.length === 0) return 0;

  const basEslesti = q.some((word) => benzer(n[0], word)) ? 1 : 0;
  const kapsanan = q.filter((word) => n.some((other) => benzer(other, word))).length / q.length;

  return basEslesti * 0.6 + kapsanan * 0.4;
}

/**
 * Kalorisi sıfır olmayan, fiziksel olarak mümkün ve sorguya en ilgili sonucu
 * seçer.
 *
 * Kaynaklar topluluk verisi içeriyor; "rice" araması 1900 kcal/100 g döndüren
 * bir kayda denk gelebiliyor. Böyle bir değeri göstermek, kalori uydurmakla
 * aynı sonucu doğurur.
 */
function pickBest(
  results: NutritionSearchResult[],
  query: string,
): NutritionSearchResult | null {
  const uygun = results.filter(
    (item) => item.per100.caloriesPer100 > 0 && isPlausible(item.per100),
  );
  if (uygun.length === 0) return null;

  // Eşit puanda kaynağın kendi sıralaması korunur (reduce ilkini tutar).
  return uygun.reduce((best, item) =>
    relevance(query, item.name) > relevance(query, best.name) ? item : best,
  );
}
