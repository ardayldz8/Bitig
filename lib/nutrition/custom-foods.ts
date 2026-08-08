import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Kendi besininin arama sonucu.
 *
 * NutritionSearchResult KULLANILMIYOR: onun `provider` alanı yalnızca dış
 * sağlayıcıları kabul ediyor ve tip uyumu için "usda" yazmak, kullanıcının
 * kendi kaydını USDA'dan gelmiş gibi göstermek olurdu. Kaynağın doğru
 * görünmesi, bu uygulamadaki her şeyin dayandığı kural.
 */
export type CustomFoodMatch = {
  id: string;
  name: string;
  brand: string | null;
  caloriesPer100: number;
  proteinPer100: number;
  carbohydratesPer100: number;
  fatPer100: number;
  basis: "g" | "ml";
  servingGrams: number | null;
};

/** Karşılaştırma anahtarı — "Beyaz Peynir" ≡ "beyaz peynir". */
function anahtar(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

/**
 * Kullanıcının kendi besinlerinde arama.
 *
 * Dış kaynaklardan ÖNCE çalışıyor: kullanıcı bir kez "simit 306 kcal" dediyse,
 * bir daha hiçbir katalogda aranmasına gerek yok. Kendi tanımı her zaman
 * kazanır — çünkü onu bilerek girdi ve genel bir veritabanı kaydından daha
 * doğru olduğunu düşünüyor.
 *
 * Eşleşme ÇİFT YÖNLÜ içerme:
 *  - sorgu adın içinde  → "simit" araması "Susamlı Simit"i bulur
 *  - ad sorgunun içinde → "susamlı simit" araması "Simit"i bulur
 *
 * İkincisi şart: AI, yemek metninden "susamlı simit" gibi nitelemeli
 * sorgular üretiyor ve tek yönlü eşleşmede kullanıcının "Simit" tanımı
 * bulunamıyordu.
 *
 * Ters yönde en az 4 harf aranıyor: 2-3 harfli bir tanım ("su", "bal")
 * neredeyse her sorguda geçer ve alakasız eşleşme üretirdi.
 */
export async function searchCustomFoods(
  client: SupabaseClient,
  userId: string,
  queries: string[],
): Promise<CustomFoodMatch | null> {
  const { data } = await client
    .from("custom_foods")
    .select("*")
    .eq("user_id", userId);

  const kayitlar = data ?? [];
  if (kayitlar.length === 0) return null;

  const sayi = (deger: unknown): number => {
    const n = typeof deger === "number" ? deger : Number(deger);
    return Number.isFinite(n) ? n : 0;
  };

  for (const sorgu of queries) {
    const q = anahtar(sorgu);
    if (!q) continue;

    // Önce tam eşleşme
    const tam = kayitlar.find((row) => anahtar(String(row.name)) === q);

    // Sonra sorgu adın içinde: "simit" → "Susamlı Simit"
    const adIcinde = tam ?? kayitlar.find((row) => anahtar(String(row.name)).includes(q));

    // Son olarak ad sorgunun içinde: "susamlı simit" → "Simit"
    const iceren =
      adIcinde ??
      kayitlar.find((row) => {
        const ad = anahtar(String(row.name));
        return ad.length >= 4 && q.includes(ad);
      });

    if (!iceren) continue;

    return {
      id: String(iceren.id),
      name: String(iceren.name),
      brand: typeof iceren.brand === "string" && iceren.brand ? iceren.brand : null,
      caloriesPer100: sayi(iceren.calories_per_100),
      proteinPer100: sayi(iceren.protein_per_100),
      carbohydratesPer100: sayi(iceren.carbohydrates_per_100),
      fatPer100: sayi(iceren.fat_per_100),
      basis: iceren.basis === "ml" ? "ml" : "g",
      servingGrams:
        iceren.serving_grams === null || iceren.serving_grams === undefined
          ? null
          : sayi(iceren.serving_grams),
    };
  }

  return null;
}
