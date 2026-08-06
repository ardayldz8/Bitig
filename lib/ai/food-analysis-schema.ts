import { z } from "zod";

/**
 * AI'nın DÖNDÜREBİLECEĞİ tek şema. Dikkat: burada kalori/makro alanı YOKTUR.
 * Model yalnızca "ne görüyorum" sorusunu yanıtlar; besin değerleri ayrı
 * sağlayıcılardan gelir.
 */
export const foodVisionResultSchema = z.object({
  imageType: z.enum(["meal", "packaged_product", "nutrition_label", "barcode", "unknown"]),
  barcode: z.string().min(6).max(20).regex(/^\d+$/).nullable(),
  overallConfidence: z.number().min(0).max(1),
  hasUnreadableText: z.boolean(),
  detectedItems: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        brand: z.string().max(80).nullable(),
        estimatedQuantity: z.number().positive().max(10000).nullable(),
        unit: z.enum(["g", "ml", "piece", "portion", "unknown"]),
        confidence: z.number().min(0).max(1),
        searchQueries: z.array(z.string().min(1).max(120)).max(6),
      }),
    )
    .max(20),
  needsUserConfirmation: z.boolean(),
});

export type FoodVisionResult = z.infer<typeof foodVisionResultSchema>;

/** Besin etiketi OCR sonucu. Bu değerler de otomatik doğru kabul edilmez. */
export const nutritionLabelResultSchema = z.object({
  productName: z.string().max(120).nullable(),
  brand: z.string().max(80).nullable(),
  servingSize: z.number().positive().max(10000).nullable(),
  servingUnit: z.string().max(20).nullable(),
  calories: z.number().min(0).max(10000).nullable(),
  protein: z.number().min(0).max(1000).nullable(),
  carbohydrates: z.number().min(0).max(1000).nullable(),
  fat: z.number().min(0).max(1000).nullable(),
  valuesArePer100: z.boolean(),
  confidence: z.number().min(0).max(1),
});

export type NutritionLabelResult = z.infer<typeof nutritionLabelResultSchema>;

/** OpenRouter'a gönderilen JSON Schema (structured output — serbest metin yok). */
export const FOOD_VISION_JSON_SCHEMA = {
  name: "food_vision_result",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "imageType",
      "barcode",
      "overallConfidence",
      "hasUnreadableText",
      "detectedItems",
      "needsUserConfirmation",
    ],
    properties: {
      imageType: {
        type: "string",
        enum: ["meal", "packaged_product", "nutrition_label", "barcode", "unknown"],
      },
      barcode: { type: ["string", "null"] },
      overallConfidence: { type: "number" },
      hasUnreadableText: { type: "boolean" },
      detectedItems: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "name",
            "brand",
            "estimatedQuantity",
            "unit",
            "confidence",
            "searchQueries",
          ],
          properties: {
            name: { type: "string" },
            brand: { type: ["string", "null"] },
            estimatedQuantity: { type: ["number", "null"] },
            unit: { type: "string", enum: ["g", "ml", "piece", "portion", "unknown"] },
            confidence: { type: "number" },
            searchQueries: { type: "array", items: { type: "string" } },
          },
        },
      },
      needsUserConfirmation: { type: "boolean" },
    },
  },
} as const;

export const NUTRITION_LABEL_JSON_SCHEMA = {
  name: "nutrition_label_result",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "productName",
      "brand",
      "servingSize",
      "servingUnit",
      "calories",
      "protein",
      "carbohydrates",
      "fat",
      "valuesArePer100",
      "confidence",
    ],
    properties: {
      productName: { type: ["string", "null"] },
      brand: { type: ["string", "null"] },
      servingSize: { type: ["number", "null"] },
      servingUnit: { type: ["string", "null"] },
      calories: { type: ["number", "null"] },
      protein: { type: ["number", "null"] },
      carbohydrates: { type: ["number", "null"] },
      fat: { type: ["number", "null"] },
      valuesArePer100: { type: "boolean" },
      confidence: { type: "number" },
    },
  },
} as const;
