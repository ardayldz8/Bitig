import { NextResponse } from "next/server";
import { z } from "zod";
import {
  FOOD_TEXT_JSON_SCHEMA,
  FOOD_TEXT_SYSTEM_PROMPT,
  foodTextResultSchema,
  type FoodTextResult,
} from "@/lib/ai/food-text-schema";
import { generateStructured, ProjectAiError } from "@/lib/ai/project-assistant";
import { AI_SECURITY_PREAMBLE, wrapUntrusted } from "@/lib/ai/security";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  text: z.string().trim().min(3).max(2000),
});

/**
 * Serbest metinden yiyecek çıkarımı.
 *
 * Fotoğraf akışının metin karşılığı: model yalnızca NE ve NE KADAR yendiğini
 * belirler, besin değeri ÜRETMEZ. Kalori ve makrolar bu yanıttan sonra
 * `/api/food/search` üzerinden izin verilen kaynaklardan çekilir.
 */
export async function POST(request: Request) {
  const limit = checkRateLimit(clientKey(request, "describe"), 15, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Çok fazla istek gönderdin. Biraz bekleyip tekrar dene." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ne yediğini birkaç kelimeyle yaz." },
      { status: 400 },
    );
  }

  try {
    const result = await generateStructured<FoodTextResult>({
      systemPrompt: `${AI_SECURITY_PREAMBLE}\n\n${FOOD_TEXT_SYSTEM_PROMPT}`,
      // Kullanıcı metni güvenilmeyen veri olarak etiketlenir: içine gömülü
      // talimatlar sistem promptunu geçersiz kılmasın.
      userPrompt: `${wrapUntrusted("kullanici_metni", parsed.data.text)}\n\nBu metinden yiyecekleri çıkar.`,
      jsonSchema: FOOD_TEXT_JSON_SCHEMA,
      schema: foodTextResultSchema,
      signal: request.signal,
    });

    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof ProjectAiError) {
      const status = error.status === 503 ? 503 : 502;
      return NextResponse.json(
        {
          error:
            status === 503
              ? "AI yapılandırılmamış. Yiyecekleri elle ekleyebilirsin."
              : "Metin çözümlenemedi. Tekrar dener misin?",
        },
        { status },
      );
    }
    return NextResponse.json({ error: "Beklenmeyen bir hata oluştu." }, { status: 500 });
  }
}
