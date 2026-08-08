/** Kalori verisi çekilmesine izin verilen tek liste. Başka kaynak kullanılmaz. */
export const ALLOWED_NUTRITION_PROVIDERS = [
  "fatsecret",
  "open_food_facts",
  "usda",
] as const;

export type NutritionProviderName = (typeof ALLOWED_NUTRITION_PROVIDERS)[number];

/** Bir değerin nereden geldiği. AI asla kaynak değildir. */
export type NutritionSource =
  | NutritionProviderName
  /*
   * Kullanıcının kendi tarifi. "manual" DEĞİL: değerler elle girilmiş
   * tahminler değil, gerçek kaynaklardan gelen malzemelerden hesaplanmış.
   * Ayrı tutulması, bir kaydın nereden geldiğinin izlenebilir kalmasını
   * sağlıyor.
   */
  | "recipe"
  /*
   * Kullanıcının kendi tanımladığı besin. "manual" DEĞİL: manual her kayıtta
   * yeniden elle girilen tahmin, bu ise bir kez tanımlanıp tekrar kullanılan
   * kayıt. Ayrı tutulması, bir değerin nereden geldiğini izlenebilir kılıyor.
   */
  | "custom"
  | "nutrition_label"
  | "manual";

export const SOURCE_LABELS: Record<NutritionSource, string> = {
  fatsecret: "FatSecret",
  open_food_facts: "Open Food Facts",
  usda: "USDA FoodData Central",
  recipe: "Kendi tarifim",
  custom: "Kendi besinim",
  nutrition_label: "Besin etiketi",
  manual: "Manuel",
};

export type FoodUnit = "g" | "ml" | "piece" | "portion";

/** Yiyeceğin türü — hangi sağlayıcı zincirinin kullanılacağını belirler. */
export type FoodKind =
  | "branded_packaged"
  | "turkish_or_restaurant"
  | "generic_basic";

/** Sağlayıcıdan gelen değerler daima 100 g / 100 ml bazına normalize edilir. */
export type NutritionPer100 = {
  caloriesPer100: number;
  proteinPer100: number;
  carbohydratesPer100: number;
  fatPer100: number;
  basis: "g" | "ml";
};

export type NutritionSearchResult = {
  provider: NutritionProviderName;
  foodId: string;
  name: string;
  brand: string | null;
  per100: NutritionPer100;
  /** Sağlayıcının bildirdiği tek porsiyonun gram karşılığı (varsa). */
  servingGrams: number | null;
};

export type NutritionSearchQuery = {
  query: string;
  brand?: string | null;
  kind?: FoodKind;
};

/** Tüm besin sağlayıcılarının uyguladığı ortak arayüz. */
export interface NutritionProvider {
  name: NutritionSource;
  /** Gerekli ortam değişkenleri yoksa false — zincir bu sağlayıcıyı atlar. */
  isConfigured(): boolean;
  search(
    query: NutritionSearchQuery,
    signal?: AbortSignal,
  ): Promise<NutritionSearchResult[]>;
  getByBarcode?(
    barcode: string,
    signal?: AbortSignal,
  ): Promise<NutritionSearchResult | null>;
}
