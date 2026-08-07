import { fatSecretProvider } from "@/lib/nutrition/fatsecret";
import { openFoodFactsProvider } from "@/lib/nutrition/open-food-facts";
import { usdaProvider } from "@/lib/nutrition/usda";
import {
  ALLOWED_NUTRITION_PROVIDERS,
  type FoodKind,
  type NutritionProvider,
  type NutritionProviderName,
} from "@/types/nutrition";

const REGISTRY: Record<NutritionProviderName, NutritionProvider> = {
  fatsecret: fatSecretProvider,
  open_food_facts: openFoodFactsProvider,
  usda: usdaProvider,
};

export function getProvider(name: NutritionProviderName): NutritionProvider {
  return REGISTRY[name];
}

/** Yalnızca izin verilen ve yapılandırılmış sağlayıcılar. */
export function configuredProviders(): NutritionProviderName[] {
  return ALLOWED_NUTRITION_PROVIDERS.filter((name) => REGISTRY[name].isConfigured());
}

/**
 * Yiyecek türüne göre denenecek sağlayıcı sırası.
 * Zincirdeki tüm kaynaklar boş dönerse manuel girişe düşülür.
 *
 * `open_food_facts` her zincirin sonunda: FatSecret ve USDA tarif/genel besin
 * için daha iyi kaynaklar ama anahtarları tanımlı olmayabiliyor. O durumda
 * zincir tamamen yapılandırılmamış sağlayıcılardan oluşuyor ve her arama
 * manuel girişe düşüyordu — tabak yemeği fotoğraflamak işe yaramıyordu.
 *
 * Bu, "besin değeri uydurulmaz" kuralını bozmaz: Open Food Facts da izin
 * verilen üç kaynaktan biri.
 */
export function providerChain(input: {
  kind: FoodKind;
  hasBarcode: boolean;
}): NutritionProviderName[] {
  if (input.hasBarcode) {
    return ["open_food_facts", "fatsecret"];
  }

  switch (input.kind) {
    case "branded_packaged":
      return ["open_food_facts", "fatsecret"];

    /*
     * Ev yemeği. Open Food Facts PAKETLİ ürün veritabanı: "pilav" arayınca
     * "Tatlı Ekşi Soslu Tavuk & Basmati Pirinç Pilavı" gibi hazır yemekler
     * döndürüyor — ev yapımı için sistematik olarak yanlış.
     *
     * USDA'nın Survey (FNDDS) seti ise pişmiş yemek kayıtlarından oluşuyor ve
     * Türk mutfağına şaşırtıcı biçimde yakın karşılıklar içeriyor: "Soup,
     * lentil" 60 kcal, "Rice pilaf" 137, "Eggplant and meat casserole" 96.
     * Bu yüzden önce USDA; OFF, FNDDS'te karşılığı olmayanlar (simit, ayran,
     * beyaz peynir) için arkada duruyor.
     */
    case "turkish_or_restaurant":
      return ["fatsecret", "usda", "open_food_facts"];

    // Evrensel besinler (pirinç, tavuk, yumurta): USDA burada gerçekten iyi,
    // küratörlü ve tutarlı.
    case "generic_basic":
      return ["fatsecret", "usda", "open_food_facts"];
  }
}
