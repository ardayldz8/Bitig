import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  FOOD_TEXT_JSON_SCHEMA,
  FOOD_TEXT_SYSTEM_PROMPT,
  foodTextResultSchema,
} from "@/lib/ai/food-text-schema";
import { AI_SECURITY_PREAMBLE, wrapUntrusted } from "@/lib/ai/security";
import {
  env,
  githubAppStatus,
  openRouterStatus,
  supabaseAdminStatus,
  webPushStatus,
} from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Canlı ortamın durumunu dışarıdan görebilmek için.
 *
 * Yerelde çalışıp canlıda çalışmayan bir sorunu teşhis etmenin başka yolu
 * yoktu: uygulama giriş duvarının arkasında, sunucu günlüklerine erişim yok
 * ve hata mesajları kullanıcıya sadeleştirilerek gösteriliyor.
 *
 * GİZLİ DEĞER DÖNDÜRMÜYOR — yalnızca "tanımlı mı", model adı ve canlı bir
 * AI çağrısının sonucu. Yine de paylaşılan sırla korunuyor: hangi
 * entegrasyonların eksik olduğu bilgisi bile dışarıya açık olmamalı.
 */
export async function GET(request: Request) {
  const expected = env.reminderDispatchSecret();
  if (!expected) {
    return NextResponse.json({ error: "Yapılandırılmamış." }, { status: 503 });
  }
  if (!secretMatches(request.headers.get("x-dispatch-secret") ?? "", expected)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const durum = {
    supabase: supabaseAdminStatus(),
    openRouter: openRouterStatus(),
    webPush: webPushStatus(),
    github: githubAppStatus(),
    models: {
      project: env.projectModel(),
      primary: process.env.OPENROUTER_PRIMARY_MODEL || "(varsayılan)",
      fallback: process.env.OPENROUTER_FALLBACK_MODEL || "(varsayılan)",
    },
    appUrl: env.appUrl(),
  };

  // `ping=1` ile gerçek bir AI çağrısı denenir — asıl teşhis bu
  if (new URL(request.url).searchParams.get("ping") !== "1") {
    return NextResponse.json(durum);
  }

  /*
   * Birden çok model ölçülebiliyor: canlıdaki yavaşlığın modelden mi yoksa
   * Netlify'ın ağ yolundan mı geldiğini ancak yan yana ölçerek ayırt
   * edebiliyoruz.
   */
  const istenen = new URL(request.url).searchParams.get("models");
  const modeller = istenen ? istenen.split(",").slice(0, 4) : [env.projectModel()];

  const olc = async (model: string): Promise<Record<string, unknown>> => {
  const t0 = Date.now();
  let ai: Record<string, unknown>;
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openRouterKey()}`,
        "Content-Type": "application/json",
      },
      /*
       * GERÇEK yolun aynısı: yapılandırılmış çıktı + aynı şema + aynı prompt.
       * Basit bir "OK yaz" isteği canlıda sorunsuz geçiyordu ama kullanıcının
       * yaşadığı hata bu yolda değildi — teşhis, hata veren çağrının kendisini
       * taklit etmeli.
       */
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 2500,
        messages: [
          { role: "system", content: `${AI_SECURITY_PREAMBLE}

${FOOD_TEXT_SYSTEM_PROMPT}` },
          {
            role: "user",
            content: `${wrapUntrusted("kullanici_metni", "az önce tost yedim")}

Bu metinden yiyecekleri çıkar.`,
          },
        ],
        response_format: { type: "json_schema", json_schema: FOOD_TEXT_JSON_SCHEMA },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    const govde = await response.text();
    if (!response.ok) {
      ai = { model, status: response.status, ms: Date.now() - t0, body: govde.slice(0, 300) };
    } else {
      // Şema doğrulaması da burada: kullanıcının gördüğü hata buradan da gelebilir
      const payload = JSON.parse(govde) as {
        choices?: { message?: { content?: string }; finish_reason?: string }[];
      };
      const icerik = payload.choices?.[0]?.message?.content;
      const parsed = icerik ? foodTextResultSchema.safeParse(JSON.parse(icerik)) : null;
      ai = {
        model,
        status: 200,
        ms: Date.now() - t0,
        finish: payload.choices?.[0]?.finish_reason ?? null,
        contentLength: icerik?.length ?? 0,
        schemaOk: parsed?.success ?? false,
        items: parsed?.success ? parsed.data.items.length : null,
        schemaError: parsed && !parsed.success ? JSON.stringify(parsed.error.issues[0]).slice(0, 200) : null,
      };
    }
  } catch (error) {
    ai = {
      model,
      status: null,
      ms: Date.now() - t0,
      body: error instanceof Error ? error.message.slice(0, 200) : "bilinmeyen hata",
    };
  }
    return ai;
  };

  const olcumler = [];
  for (const model of modeller) olcumler.push(await olc(model));

  return NextResponse.json({ ...durum, ai: olcumler });
}
