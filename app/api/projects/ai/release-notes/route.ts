import { NextResponse } from "next/server";
import { generateStructured, aiErrorMessage } from "@/lib/ai/project-assistant";
import { buildContextPrompt, projectContextSchema } from "@/lib/ai/project-tools";
import { RELEASE_NOTES_JSON_SCHEMA, releaseNotesDraftSchema } from "@/lib/ai/schemas";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `Son değişikliklerden bir RELEASE NOTE TASLAĞI (Markdown) üretirsin.

Kurallar — ÇOK ÖNEMLİ:
- YALNIZCA sana verilen commit, PR, issue ve tamamlanmış özelliklerden yararlan.
- Verilerde OLMAYAN hiçbir değişikliği yazma. Emin değilsen madde ekleme.
- "sourceCount" alanına, gerçekten kullandığın kaynak madde sayısını yaz.
- Kaynak yoksa markdown içinde bunu açıkça belirt ve boş bir liste ver.
- Çıktı Türkçe olsun.`;

export async function POST(request: Request) {
  const limit = checkRateLimit(clientKey(request, "ai-release"), 6, 60_000);
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
    const notes = await generateStructured({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: `${buildContextPrompt(parsed.data)}\n\nSon değişikliklerden release note taslağı üret.`,
      jsonSchema: RELEASE_NOTES_JSON_SCHEMA,
      schema: releaseNotesDraftSchema,
      signal: request.signal,
    });

    return NextResponse.json({ notes });
  } catch (error) {
    return NextResponse.json({ error: aiErrorMessage(error) }, { status: 502 });
  }
}
