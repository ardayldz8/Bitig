import { NextResponse } from "next/server";
import {
  FOOD_VISION_JSON_SCHEMA,
  foodVisionResultSchema,
  type FoodVisionResult,
} from "@/lib/ai/food-analysis-schema";
import {
  OPENROUTER_CONFIG,
  OpenRouterError,
  VISION_SYSTEM_PROMPT,
  callVisionModel,
  isOpenRouterConfigured,
  shouldEscalate,
} from "@/lib/ai/openrouter";
import { imageErrorMessage, validateImageFile } from "@/lib/calorie/validation";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const USER_PROMPT =
  "Bu görseldeki yiyecek/ürünleri tanı. Besin değeri ÜRETME; yalnızca ne gördüğünü, " +
  "markayı, varsa barkodu, yaklaşık porsiyonu ve besin veritabanında aranacak sorguları ver.";

type AnalyzeResponse = {
  result: FoodVisionResult;
  modelUsed: string;
  escalated: boolean;
};

export async function POST(request: Request) {
  const limit = checkRateLimit(clientKey(request, "analyze"), 12, 60_000);
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
          "Fotoğraf analizi şu an kapalı (OPENROUTER_API_KEY tanımlı değil). Yiyeceği manuel ekleyebilirsin.",
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
    const primary = await runModel(OPENROUTER_CONFIG.primaryModel, validation.image.dataUrl);

    if (!shouldEscalate(primary)) {
      return NextResponse.json({
        result: primary,
        modelUsed: OPENROUTER_CONFIG.primaryModel,
        escalated: false,
      } satisfies AnalyzeResponse);
    }

    // Güven düşük / karmaşık görsel → güçlü modele yükselt
    try {
      const fallback = await runModel(
        OPENROUTER_CONFIG.fallbackModel,
        validation.image.dataUrl,
      );
      return NextResponse.json({
        result: fallback,
        modelUsed: OPENROUTER_CONFIG.fallbackModel,
        escalated: true,
      } satisfies AnalyzeResponse);
    } catch {
      // Yedek model de başarısızsa birincil sonucu kullan
      return NextResponse.json({
        result: primary,
        modelUsed: OPENROUTER_CONFIG.primaryModel,
        escalated: false,
      } satisfies AnalyzeResponse);
    }
  } catch (error) {
    // Dış servis hatası kullanıcıya ham hâlde gösterilmez
    const status = error instanceof OpenRouterError ? error.status : 502;
    return NextResponse.json(
      { error: "Fotoğraf analiz edilemedi. Tekrar deneyebilir ya da manuel ekleyebilirsin." },
      { status },
    );
  }
}

async function runModel(model: string, imageDataUrl: string): Promise<FoodVisionResult> {
  const raw = await callVisionModel({
    model,
    systemPrompt: VISION_SYSTEM_PROMPT,
    userPrompt: USER_PROMPT,
    imageDataUrl,
    jsonSchema: FOOD_VISION_JSON_SCHEMA,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new OpenRouterError("Model geçersiz JSON döndürdü.", 502);
  }

  // Model çıktısına asla doğrudan güvenilmez
  const validated = foodVisionResultSchema.safeParse(parsed);
  if (!validated.success) {
    throw new OpenRouterError("Model şemaya uymayan çıktı döndürdü.", 502);
  }

  return validated.data;
}
