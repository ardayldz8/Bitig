import type { NutritionPer100 } from "@/types/nutrition";

/**
 * Fiziksel olarak imkânsız besin değerlerini eler.
 *
 * Kaynaklar (özellikle Open Food Facts) topluluk verisi; hatalı kayıtlar var.
 * Gerçek bir örnek: "rice" araması 1900 kcal/100 g döndürdü — muhtemelen kJ
 * değeri kcal alanına yazılmış.
 *
 * Uygulamanın kuralı "besin değeri uydurulmaz". Uydurmamak yetmiyor: imkânsız
 * bir değeri gerçekmiş gibi göstermek de aynı kapıya çıkıyor. Şüpheli kayıt
 * elenir ve kullanıcı manuel girişe yönlendirilir.
 */

/** Saf yağ 884 kcal/100 g; üstü hiçbir yiyecek için mümkün değil. */
const MAX_KCAL_PER_100 = 900;

/** 100 g'da 100 g'dan fazla makro olamaz (yuvarlama payı bırakılır). */
const MAX_MACRO_GRAMS = 100;
const MAX_MACRO_TOPLAM = 105;

/**
 * Atwater katsayıları: protein 4, karbonhidrat 4, yağ 9 kcal/g.
 *
 * Tolerans bilerek çok geniş: sapma iki yönde de meşru olabiliyor.
 *   - Lif karbonhidrata yazılır ama sindirilmediği için kalori vermez
 *     → hesap gerçek değerin üstüne çıkar (kepekte 1,5 katına kadar).
 *   - Alkol 7 kcal/g verir ama makro listesinde yoktur
 *     → hesap gerçek değerin altında kalır.
 *
 * Bu yüzden yalnızca büyüklük mertebesi hataları elenir; ince sapma
 * kovalanmaz. Zaten asıl koruma mutlak sınırlarda.
 */
const ATWATER_KAT_SINIRI = 3;

export type PlausibilityResult =
  | { ok: true }
  | { ok: false; reason: string };

export function checkPlausibility(per100: NutritionPer100): PlausibilityResult {
  const { caloriesPer100, proteinPer100, carbohydratesPer100, fatPer100 } = per100;

  for (const [label, value] of [
    ["kalori", caloriesPer100],
    ["protein", proteinPer100],
    ["karbonhidrat", carbohydratesPer100],
    ["yağ", fatPer100],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) {
      return { ok: false, reason: `${label} değeri geçersiz` };
    }
  }

  if (caloriesPer100 > MAX_KCAL_PER_100) {
    return { ok: false, reason: `kalori imkânsız (${Math.round(caloriesPer100)} kcal/100)` };
  }

  for (const [label, value] of [
    ["protein", proteinPer100],
    ["karbonhidrat", carbohydratesPer100],
    ["yağ", fatPer100],
  ] as const) {
    if (value > MAX_MACRO_GRAMS) {
      return { ok: false, reason: `${label} imkânsız (${Math.round(value)} g/100)` };
    }
  }

  if (proteinPer100 + carbohydratesPer100 + fatPer100 > MAX_MACRO_TOPLAM) {
    return { ok: false, reason: "makro toplamı 100 g'ı aşıyor" };
  }

  // Makrolar bildirilmişse kaloriyle tutarlı olmalı. Hepsi sıfırsa kaynak
  // makro vermemiş demektir; bu tek başına hata sayılmaz.
  const macroToplam = proteinPer100 + carbohydratesPer100 + fatPer100;
  if (macroToplam > 0 && caloriesPer100 > 0) {
    const beklenen = proteinPer100 * 4 + carbohydratesPer100 * 4 + fatPer100 * 9;
    const kat = Math.max(beklenen / caloriesPer100, caloriesPer100 / beklenen);
    if (kat > ATWATER_KAT_SINIRI) {
      return {
        ok: false,
        reason: `kalori makrolarla uyuşmuyor (${Math.round(caloriesPer100)} vs ~${Math.round(beklenen)})`,
      };
    }
  }

  return { ok: true };
}

export function isPlausible(per100: NutritionPer100): boolean {
  return checkPlausibility(per100).ok;
}
