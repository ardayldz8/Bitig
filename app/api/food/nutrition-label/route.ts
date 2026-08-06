import { NextResponse } from "next/server";
import {
  NUTRITION_LABEL_JSON_SCHEMA,
  nutritionLabelResultSchema,
  type NutritionLabelResult,
} from "@/lib/ai/food-analysis-schema";
import {
  LABEL_SYSTEM_PROMPT,
  OPENROUTER_CONFIG,
  OpenRouterError,
  callVisionModel,
  isOpenRouterConfigured,
} from "@/lib/ai/openrouter";
import { imageErrorMessage, validateImageFile } from "@/lib/calorie/validation";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const USER_PROMPT =
  "Bu besin değerleri etiketindeki sayıları oku. Etikette yazmayan değerleri null bırak; tahmin etme.";

export async function POST(request: Request) {
  const limit = checkRateLimit(clientKey(request, "label"), 12, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Çok fazla istek gönderdin. Biraz bekleyip tekrar dene." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  if (!isOpenRouterConfigured()) {
    return NextResponse.json(
      {
        error:
          "Etiket okuma şu an kapalı (OPENROUTER_API_KEY tanımlı değil). Değerleri manuel girebilirsin.",
      },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const validation = await validateImageFile(form.get("image"));
  if (!validation.ok) {
    return NextResponse.json({ error: imageErrorMessage(validation.error) }, { status: 400 });
  }

  try {
    let result = await runLabelModel(
      OPENROUTER_CONFIG.primaryModel,
      validation.image.dataUrl,
    );

    // Etiket okunamadıysa güçlü modele yükselt
    const unreadable = result.confidence < 0.8 || result.calories === null;
    if (unreadable) {
      try {
        result = await runLabelModel(
          OPENROUTER_CONFIG.fallbackModel,
          validation.image.dataUrl,
        );
      } catch {
        // birincil sonucu kullan
      }
    }

    return NextResponse.json({ result });
  } catch (error) {
    const status = error instanceof OpenRouterError ? error.status : 502;
    return NextResponse.json(
      { error: "Etiket okunamadı. Değerleri manuel girebilirsin." },
      { status },
    );
  }
}

async function runLabelModel(
  model: string,
  imageDataUrl: string,
): Promise<NutritionLabelResult> {
  const raw = await callVisionModel({
    model,
    systemPrompt: LABEL_SYSTEM_PROMPT,
    userPrompt: USER_PROMPT,
    imageDataUrl,
    jsonSchema: NUTRITION_LABEL_JSON_SCHEMA,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new OpenRouterError("Model geçersiz JSON döndürdü.", 502);
  }

  const validated = nutritionLabelResultSchema.safeParse(parsed);
  if (!validated.success) {
    throw new OpenRouterError("Model şemaya uymayan çıktı döndürdü.", 502);
  }

  return validated.data;
}
