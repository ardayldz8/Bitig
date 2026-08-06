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
    case "turkish_or_restaurant":
      return ["fatsecret", "usda"];
    case "generic_basic":
      return ["fatsecret", "usda"];
  }
}
