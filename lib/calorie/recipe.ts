/**
 * Tarif = malzemelerden hesaplanan bileşik yemek.
 *
 * Ev yapımı Türk yemekleri (karnıyarık, adana kebap, kuru fasulye) hiçbir
 * besin veritabanında yok — USDA Amerikan gıda kompozisyonuna, Open Food
 * Facts paketli ürünlere dayalı. Ama MALZEMELER her ikisinde de iyi kapsanmış.
 *
 * Bu yüzden yemeği bir kez malzemelerinden tanımlamak, herhangi bir genel
 * veritabanı kaydından daha doğru sonuç veriyor: kullanıcının kendi tarifi.
 */

export type RecipeIngredient = {
  id: string;
  recipeId: string;
  name: string;
  /** Tarife giren miktar (çiğ ya da hazır hâliyle, kullanıcının girdiği gibi). */
  grams: number;
  caloriesPer100: number;
  proteinPer100: number;
  carbohydratesPer100: number;
  fatPer100: number;
  source: string;
};

export type Recipe = {
  id: string;
  name: string;
  /**
   * Tarifin tamamının PİŞMİŞ ağırlığı.
   *
   * Malzeme toplamından ayrı tutuluyor çünkü pişerken su kaybı/kazancı
   * oluyor: 1200 g malzeme 900 g yemeğe dönüşebiliyor. Porsiyon başına
   * kaloriyi malzeme toplamına bölmek, yenen 300 g'ın kalorisini
   * olduğundan düşük gösterirdi.
   */
  totalGrams: number;
  updatedAt: string;
};

export type RecipeTotals = {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  /** Malzemelerin ham toplam ağırlığı — pişmiş ağırlıkla karşılaştırmak için. */
  ingredientGrams: number;
};

/** Malzemelerin tarif geneli toplamı. */
export function recipeTotals(ingredients: RecipeIngredient[]): RecipeTotals {
  return ingredients.reduce<RecipeTotals>(
    (sum, item) => {
      const oran = item.grams / 100;
      return {
        calories: sum.calories + item.caloriesPer100 * oran,
        protein: sum.protein + item.proteinPer100 * oran,
        carbohydrates: sum.carbohydrates + item.carbohydratesPer100 * oran,
        fat: sum.fat + item.fatPer100 * oran,
        ingredientGrams: sum.ingredientGrams + item.grams,
      };
    },
    { calories: 0, protein: 0, carbohydrates: 0, fat: 0, ingredientGrams: 0 },
  );
}

/** Pişmiş yemeğin 100 g'ındaki değerler — kalori kaydına bu yazılır. */
export function recipePer100(
  ingredients: RecipeIngredient[],
  totalGrams: number,
): { caloriesPer100: number; proteinPer100: number; carbohydratesPer100: number; fatPer100: number } | null {
  if (ingredients.length === 0 || totalGrams <= 0) return null;

  const t = recipeTotals(ingredients);
  const oran = 100 / totalGrams;

  return {
    caloriesPer100: t.calories * oran,
    proteinPer100: t.protein * oran,
    carbohydratesPer100: t.carbohydrates * oran,
    fatPer100: t.fat * oran,
  };
}

/**
 * Pişmiş ağırlık malzeme toplamından çok saparsa uyarı.
 *
 * Yazım hatası (900 yerine 90) tarifin kalorisini on kat şişiriyor ve bu
 * sessizce her öğüne yansıyor. Pişme kaybı normalde %40'ı geçmiyor, kazanç
 * (pilav, makarna gibi su çekenler) iki katı aşabiliyor.
 */
export function totalGramsWarning(
  ingredientGrams: number,
  totalGrams: number,
): string | null {
  if (ingredientGrams <= 0 || totalGrams <= 0) return null;

  const oran = totalGrams / ingredientGrams;
  if (oran < 0.4) {
    return "Pişmiş ağırlık malzemelerin yarısından az. Gram doğru mu?";
  }
  if (oran > 2.5) {
    return "Pişmiş ağırlık malzeme toplamının iki katından fazla. Gram doğru mu?";
  }
  return null;
}
