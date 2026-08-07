import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
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

  const t0 = Date.now();
  let ai: Record<string, unknown>;
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openRouterKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.projectModel(),
        max_tokens: 20,
        messages: [{ role: "user", content: "Yalnızca OK yaz." }],
      }),
      signal: AbortSignal.timeout(20_000),
    });

    const govde = await response.text();
    ai = {
      status: response.status,
      ms: Date.now() - t0,
      // Hata gövdesi anahtar içermez; OpenRouter'ın mesajı teşhis için şart
      body: response.ok ? "ok" : govde.slice(0, 300),
    };
  } catch (error) {
    ai = {
      status: null,
      ms: Date.now() - t0,
      body: error instanceof Error ? error.message.slice(0, 200) : "bilinmeyen hata",
    };
  }

  return NextResponse.json({ ...durum, ai });
}
