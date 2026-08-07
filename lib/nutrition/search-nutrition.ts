import { NutritionUnavailableError } from "@/lib/nutrition/unavailable";
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

  /**
   * Zincir GÜVENİLİRLİK sırasına göre dizili. Üstteki kaynak geçici olarak
   * düştüğünde alttakine geçmek, o yiyecek için daha zayıf bir kaynağı cevap
   * diye sunmak oluyor: USDA hız sınırına takılınca "yulaf" araması paketli
   * ürün veritabanından "Plant-Based Oat Drink" (47 kcal), "pirinç" araması
   * "Rice and wheat cereal" (298) döndürüyordu.
   *
   * Yanlış değer göstermektense "şu anda bakılamadı" demek daha dürüst;
   * kullanıcı birkaç dakika sonra tekrar dener ya da elle girer.
   */
  const KAYNAK_YOK = { result: null, unavailable: true } as const;

  // 1) Barkod varsa önce doğrudan barkod aramasını dene
  if (input.barcode) {
    for (const name of chain) {
      const provider = getProvider(name);
      if (!provider.isConfigured() || !provider.getByBarcode) continue;

      let found: NutritionSearchResult | null;
      try {
        found = await provider.getByBarcode(input.barcode, signal);
      } catch (error) {
        if (error instanceof NutritionUnavailableError) return KAYNAK_YOK;
        throw error;
      }

      // Barkod eşleşmesi de makul olmalı: kaynaktaki hatalı kayıt, ürün doğru
      // bulunduğu için daha da inandırıcı görünür.
      if (found && isPlausible(found.per100)) {
        return { result: found, unavailable: false };
      }
    }
  }

  // 2) Metin sorgularıyla zinciri sırayla dene
  const queries = input.queries.filter((query) => query.trim().length > 0).slice(0, 3);
  if (queries.length === 0) return { result: null, unavailable: false };

  for (const name of chain) {
    const provider = getProvider(name);
    if (!provider.isConfigured()) continue;

    for (const query of queries) {
      let results: NutritionSearchResult[];
      try {
        results = await provider.search({ query, brand: input.brand, kind: input.kind }, signal);
      } catch (error) {
        if (error instanceof NutritionUnavailableError) return KAYNAK_YOK;
        throw error;
      }

      const best = pickBest(results, query);
      if (best) return { result: best, unavailable: false };
    }
  }

  return { result: null, unavailable: false };
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
 * Aranan yiyeceğin kendisini değil, bir PARÇASINI / TÜREVİNİ / ağır işlenmiş
 * biçimini gösteren nitelemeler.
 *
 * Bunlar yalnızca kullanıcı İSTEMEDİĞİ hâlde adayda geçiyorsa cezalandırılır:
 * "portakal suyu" arayan biri için "suyu" doğru, "portakal" arayan için değil.
 *
 * Gerçek hatalardan çıkarıldı: "egg" → "egg white" (55 kcal, oysa bütün
 * yumurta ~143), "oats" → "Oat bran" ve "Oil, oat", "tavuk göğsü" →
 * "breaded" tavuk, "pilav" → "rice mix, pilaf flavor" (kuru karışım).
 */
const TUREV_NITELEMELERI = new Set([
  // parça ya da türev
  "whites", "yolk", "yolks", "bran", "germ", "oil", "juice",
  "powder", "extract", "flour", "skin", "peel", "husk", "syrup",
  // ürünü baştan başka bir şey yapan işlemler
  "breaded", "battered", "candied", "sweetened", "dehydrated",
  "concentrate", "concentrated", "mix", "flavored", "flavoured",
  "flavor", "flavour", "instant",
]);

/*
 * "white", "dry", "dried", "seeds", "leaves" BİLEREK listede yok: bunlar
 * meşru çeşit adları da olabiliyor ("Rice, white, long-grain" hâlâ pirinç,
 * kuru fasulye zaten kuru satılıyor). Liste onları içerirken doğru sonuçlar
 * eleniyordu.
 */

/**
 * Yiyeceğin sade/bütün hâlini gösteren işaretler. Ceza değil ÖDÜL: doğru
 * sonucu elemeden beraberliği doğru yöne kırar.
 *
 * "egg" araması için "Eggs, Grade A, Large, egg white" ile "...egg whole"
 * kelime sayısı bakımından birebir aynı puanı alıyor ve kaynağın sıralaması
 * belirleyici oluyordu. "whole" bunu çözüyor.
 */
const BUTUN_GIDA_ISARETLERI = new Set([
  "whole", "plain", "regular", "raw", "fresh", "cooked",
  "unsweetened", "unsalted", "nfs", "ns",
]);

/**
 * Sonucun sorguyla ne kadar ilgili olduğu (0–1).
 *
 * Dört bileşen:
 *  - kapsama: sorgu kelimelerinin kaçı adayda geçiyor
 *  - bitişiklik: sorgudaki ardışık kelime çiftleri adayda da yan yana mı.
 *    Kelime torbası tek başına "grilled cheese sandwich" ile "grilled chicken
 *    sandwich, WITH CHEESE" arasını ayıramıyor — üçü de geçtiği için ikincisi
 *    tam kapsama alıyordu. Sıra bakınca fark ortaya çıkıyor.
 *  - baş bölüm: ilk virgülden önceki kısım yiyeceğin kendisi ("oats" →
 *    "Oil, oat" ve "rice" → "Rice crackers" hataları buradan yakalanıyor)
 *  - sadelik: sorguda karşılığı olmayan fazladan kelime ne kadar azsa aday o
 *    kadar yakın. Bu olmadan "Egg, whole, raw" ile "Eggs, Grade A, Large, egg
 *    white" tam puanda berabere kalıyor ve listede önce geleni kazanıyordu.
 *
 * Baş bölüm tek başına belirleyici değil: Open Food Facts adları serbest ürün
 * adı ("Turkish Sessame Bagel Simit") ve aranan kelime sonda kalabiliyor.
 */
export function relevance(query: string, name: string): number {
  const q = tokens(query);
  const n = tokens(name);
  if (q.length === 0 || n.length === 0) return 0;

  const istendi = (word: string) => q.some((other) => benzer(word, other));

  /*
   * Adın ilk virgülden önceki kısmı yiyeceğin KENDİSİ, sonrası nitelemedir:
   * "Rice, white, long-grain, cooked" → "rice". Bileşik bir ad ise virgül yok
   * ve baş bölüm bütünüyle başka bir yiyeceği anlatır: "Rice crackers" (416
   * kcal), "Egg Noodle" (339). Sorgu baş bölümün TAMAMINA denk geliyorsa
   * doğru yiyecek; yalnızca ilk kelimesine denk geliyorsa şüpheli.
   */
  const bas = tokens(name.split(",")[0]);
  const basTamOrtusme =
    bas.length === q.length && bas.every((word) => istendi(word));
  const basPuan = basTamOrtusme ? 1 : bas.length > 0 && istendi(bas[0]) ? 0.5 : 0;

  const kapsanan = q.filter((word) => n.some((other) => benzer(other, word))).length / q.length;

  // Tek kelimelik sorguda çift yok; bileşeni nötr bırak, yoksa hepsi cezalanır.
  let bitisik = 1;
  if (q.length >= 2) {
    let eslesen = 0;
    for (let i = 0; i < q.length - 1; i++) {
      const varMi = n.some(
        (word, j) => j + 1 < n.length && benzer(word, q[i]) && benzer(n[j + 1], q[i + 1]),
      );
      if (varMi) eslesen++;
    }
    bitisik = eslesen / (q.length - 1);
  }

  const fazla = n.filter((word) => !istendi(word)).length;
  const sadelik = 1 / (1 + fazla / 3);

  const butun = n.some((word) => BUTUN_GIDA_ISARETLERI.has(word)) ? 0.04 : 0;
  const puan = Math.min(
    1,
    kapsanan * 0.4 + bitisik * 0.25 + basPuan * 0.2 + sadelik * 0.15 + butun,
  );

  const turev = n.some((word) => TUREV_NITELEMELERI.has(word) && !istendi(word));
  return turev ? puan * 0.45 : puan;
}

/**
 * Bu eşiğin altındaki en iyi aday bile kabul edilmez.
 *
 * "Yanlış yiyecek" en az "besin değeri uydurmak" kadar zararlı: kaşarlı tost
 * araması "grilled chicken, bacon and tomato sandwich" döndürüyordu. Eşiğin
 * altında kalınca kullanıcı manuel girişe düşer — bu tasarlanmış davranış.
 */
const ILGI_ESIGI = 0.5;

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
  const best = uygun.reduce((onceki, item) =>
    relevance(query, item.name) > relevance(query, onceki.name) ? item : onceki,
  );

  return relevance(query, best.name) >= ILGI_ESIGI ? best : null;
}
