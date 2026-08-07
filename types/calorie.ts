import type { FoodUnit, NutritionSource } from "@/types/nutrition";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Kahvaltı",
  lunch: "Öğle yemeği",
  dinner: "Akşam yemeği",
  snack: "Atıştırmalık",
};

export const UNIT_LABELS: Record<FoodUnit, string> = {
  g: "gram",
  ml: "mililitre",
  piece: "adet",
  portion: "porsiyon",
};

export type FoodEntry = {
  id: string;

  name: string;
  brand: string | null;

  quantity: number;
  unit: FoodUnit;

  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;

  mealType: MealType;

  source: NutritionSource;
  sourceFoodId: string | null;

  originalCalories: number | null;
  originalProtein: number | null;
  originalCarbohydrates: number | null;
  originalFat: number | null;

  manuallyEdited: boolean;

  confidence: number | null;

  consumedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type NutritionTargets = {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
};

export const defaultTargets: NutritionTargets = {
  calories: 2200,
  protein: 160,
  carbohydrates: 240,
  fat: 70,
};

/** Analiz akışının kullanıcıya gösterilen aşamaları. */
export type AnalysisStage =
  | "idle"
  | "preparing"
  | "recognizing"
  | "searching"
  | "calculating"
  | "done"
  | "error";

export const STAGE_LABELS: Record<Exclude<AnalysisStage, "idle" | "done" | "error">, string> = {
  preparing: "Fotoğraf hazırlanıyor",
  recognizing: "Yiyecekler tanınıyor",
  searching: "Besin kaynakları aranıyor",
  calculating: "Porsiyonlar hesaplanıyor",
};

/**
 * Analiz sonucunda kullanıcıya sunulan, henüz KAYDEDİLMEMİŞ satır.
 * Kullanıcı onaylamadan hiçbir şey günlüğe yazılmaz.
 */
export type DetectedFood = {
  rowId: string;
  name: string;
  brand: string | null;
  quantity: number;
  unit: FoodUnit;
  /** Besin kaynağı bulunamadıysa null — kullanıcı manuel girer. */
  match: ResolvedNutrition | null;
  /**
   * Kaynak bulundu ama miktar onun birimine çevrilemedi.
   *
   * Tipik durum: kullanıcı "iki dilim" diyor, kaynak 100 gram üzerinden veri
   * veriyor ve bir dilimin kaç gram olduğu bilinmiyor. Böyle bir satırda
   * değerler 0 çıkıyordu ve bu, gerçekten 0 kalorili bir yiyecekten ayırt
   * edilemiyordu. Artık işaretlenip kullanıcıdan gram isteniyor.
   */
  needsQuantity: boolean;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  /**
   * Kaynaktan hesaplanan değerler. Miktar değişince birlikte güncellenir,
   * kullanıcı makroya elle dokununca DEĞİŞMEZ — böylece kaydedilen kayıtta
   * sağlayıcının orijinal değeri korunur.
   */
  originalCalories: number | null;
  originalProtein: number | null;
  originalCarbohydrates: number | null;
  originalFat: number | null;
  confidence: number | null;
  manuallyEdited: boolean;
};

/** Sağlayıcıdan çözümlenmiş besin kaydı (client'a bu iner). */
export type ResolvedNutrition = {
  source: NutritionSource;
  foodId: string | null;
  name: string;
  brand: string | null;
  caloriesPer100: number;
  proteinPer100: number;
  carbohydratesPer100: number;
  fatPer100: number;
  basis: "g" | "ml";
  servingGrams: number | null;
};
