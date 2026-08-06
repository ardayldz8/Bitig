import { NextResponse } from "next/server";
import { generateStructured, aiErrorMessage } from "@/lib/ai/project-assistant";
import { buildContextPrompt, contextMetrics, projectContextSchema } from "@/lib/ai/project-tools";
import { PROJECT_SUMMARY_JSON_SCHEMA, projectSummarySchema } from "@/lib/ai/schemas";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `Sen bir yazılım projesi analistisin. Verilen proje verisini inceleyip
kısa, somut ve Türkçe bir özet çıkarırsın.

Kurallar:
- Yalnızca verilen veriye dayan. Görmediğin bir teknolojiyi, modülü veya riski UYDURMA.
- "ÖLÇÜLEN METRİKLER" bölümündeki sayılar kesindir; onları yeniden hesaplama, yorumla.
- Riskleri ve önerileri somut ve uygulanabilir yaz.
- Veri azsa bunu dürüstçe belirt.`;

export async function POST(request: Request) {
  const limit = checkRateLimit(clientKey(request, "ai-summary"), 6, 60_000);
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
    const summary = await generateStructured({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: `${buildContextPrompt(parsed.data)}\n\nBu projenin özetini çıkar.`,
      jsonSchema: PROJECT_SUMMARY_JSON_SCHEMA,
      schema: projectSummarySchema,
      signal: request.signal,
    });

    const { metrics, health } = contextMetrics(parsed.data);
    return NextResponse.json({ summary, metrics, health });
  } catch (error) {
    return NextResponse.json({ error: aiErrorMessage(error) }, { status: 502 });
  }
}
