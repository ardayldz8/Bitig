import { NextResponse } from "next/server";
import { z } from "zod";
import { generateStructured, aiErrorMessage } from "@/lib/ai/project-assistant";
import { buildContextPrompt, projectContextSchema } from "@/lib/ai/project-tools";
import { FEATURE_DRAFT_JSON_SCHEMA, featureDraftSchema } from "@/lib/ai/schemas";
import { wrapUntrusted } from "@/lib/ai/security";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  context: projectContextSchema,
  noteContent: z.string().trim().min(1).max(8000),
  noteTitle: z.string().trim().max(200).default(""),
});

const SYSTEM_PROMPT = `Kullanıcının serbest notunu, geliştirilebilir bir ÖZELLİK TASLAĞINA çevirirsin.

Kurallar:
- Taslak, notun gerçekten söylediği şeyi karşılamalı; kapsam uydurma.
- Kabul kriterleri ölçülebilir ve test edilebilir olsun.
- relatedFiles yalnızca sana verilen dosya listesinden seçilir; olmayan dosya adı YAZMA.
- Önceliği projenin mevcut durumuna göre gerekçeli seç.
- Çıktı Türkçe olsun.
- Bu yalnızca bir TASLAKTIR; hiçbir şey otomatik kaydedilmez veya GitHub'a yazılmaz.`;

export async function POST(request: Request) {
  const limit = checkRateLimit(clientKey(request, "ai-feature"), 10, 60_000);
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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Not içeriği doğrulanamadı." }, { status: 400 });
  }

  try {
    const draft = await generateStructured({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: [
        buildContextPrompt(parsed.data.context),
        "",
        wrapUntrusted(
          "kullanici_notu",
          `${parsed.data.noteTitle}\n${parsed.data.noteContent}`,
          8000,
        ),
        "",
        "Bu nottan bir özellik taslağı üret.",
      ].join("\n"),
      jsonSchema: FEATURE_DRAFT_JSON_SCHEMA,
      schema: featureDraftSchema,
      signal: request.signal,
    });

    return NextResponse.json({ draft });
  } catch (error) {
    return NextResponse.json({ error: aiErrorMessage(error) }, { status: 502 });
  }
}
