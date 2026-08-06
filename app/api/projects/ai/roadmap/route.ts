import { NextResponse } from "next/server";
import { generateStructured, aiErrorMessage } from "@/lib/ai/project-assistant";
import { buildContextPrompt, projectContextSchema } from "@/lib/ai/project-tools";
import { ROADMAP_JSON_SCHEMA, roadmapDraftSchema } from "@/lib/ai/schemas";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `Projenin mevcut durumuna bakarak bir YOL HARİTASI TASLAĞI üretirsin.

Kurallar:
- Yalnızca verilen özellikler, issue'lar, PR'lar, notlar ve metriklerden yola çık.
- Her madde için "reason" alanında NEDEN o sırada olduğunu veriye dayandırarak yaz.
- 2-4 aşama yeterli; aşamalar mantıklı bir sırayla ilerlesin.
- Var olmayan iş kalemi uydurma.
- Bu bir TASLAKTIR; otomatik kaydedilmez.
- Çıktı Türkçe olsun.`;

export async function POST(request: Request) {
  const limit = checkRateLimit(clientKey(request, "ai-roadmap"), 6, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Çok fazla istek. Biraz bekleyip tekrar dene." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const parsed = projectContextSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Proje verisi doğrulanamadı." }, { status: 400 });
  }

  try {
    const roadmap = await generateStructured({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: `${buildContextPrompt(parsed.data)}\n\nBu projeye bir yol haritası taslağı üret.`,
      jsonSchema: ROADMAP_JSON_SCHEMA,
      schema: roadmapDraftSchema,
      signal: request.signal,
    });

    return NextResponse.json({ roadmap });
  } catch (error) {
    return NextResponse.json({ error: aiErrorMessage(error) }, { status: 502 });
  }
}
