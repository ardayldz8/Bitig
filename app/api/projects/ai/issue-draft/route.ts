import { NextResponse } from "next/server";
import { z } from "zod";
import { generateStructured, aiErrorMessage } from "@/lib/ai/project-assistant";
import { buildContextPrompt, projectContextSchema } from "@/lib/ai/project-tools";
import { ISSUE_DRAFT_JSON_SCHEMA, githubIssueDraftSchema } from "@/lib/ai/schemas";
import { wrapUntrusted } from "@/lib/ai/security";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  context: projectContextSchema,
  sourceTitle: z.string().trim().min(1).max(200),
  sourceContent: z.string().trim().max(8000).default(""),
  acceptanceCriteria: z.array(z.string().max(300)).max(20).default([]),
});

const SYSTEM_PROMPT = `Bir GitHub issue TASLAĞI hazırlarsın.

Kurallar:
- Bu YALNIZCA taslaktır. Issue açma yetkin yok; kullanıcı onaylamadan hiçbir şey GitHub'a yazılmaz.
- Gövde Markdown olsun: kısa bağlam, yapılacaklar, kabul kriterleri.
- Veride olmayan dosya, sürüm veya kişi adı UYDURMA.
- Etiketler kısa ve genel olsun (ör. enhancement, bug, docs).
- Çıktı Türkçe olsun.`;

export async function POST(request: Request) {
  const limit = checkRateLimit(clientKey(request, "ai-issue"), 10, 60_000);
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
    return NextResponse.json({ error: "Taslak girdisi doğrulanamadı." }, { status: 400 });
  }

  try {
    const draft = await generateStructured({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: [
        buildContextPrompt(parsed.data.context),
        "",
        wrapUntrusted(
          "kaynak_icerik",
          [
            parsed.data.sourceTitle,
            parsed.data.sourceContent,
            parsed.data.acceptanceCriteria.length > 0
              ? `Kabul kriterleri:\n- ${parsed.data.acceptanceCriteria.join("\n- ")}`
              : "",
          ].join("\n"),
          8000,
        ),
        "",
        "Bu içerikten bir GitHub issue taslağı üret.",
      ].join("\n"),
      jsonSchema: ISSUE_DRAFT_JSON_SCHEMA,
      schema: githubIssueDraftSchema,
      signal: request.signal,
    });

    // Taslak döner; GitHub'a yazma YAPILMAZ.
    return NextResponse.json({ draft, requiresConfirmation: true });
  } catch (error) {
    return NextResponse.json({ error: aiErrorMessage(error) }, { status: 502 });
  }
}
