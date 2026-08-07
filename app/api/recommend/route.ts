import { NextResponse } from "next/server";
import { z } from "zod";
import {
  RECOMMEND_JSON_SCHEMA,
  buildRecommendPrompt,
  recommendationResultSchema,
} from "@/lib/ai/recommend-schema";
import { AI_SECURITY_PREAMBLE } from "@/lib/ai/security";
import { verifyInCatalog } from "@/lib/catalog/providers";
import type { CatalogItem } from "@/lib/catalog/types";
import { env, openRouterStatus } from "@/lib/env";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { createAdminClient, getUserId } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 45_000;
/** Doğrulama sonrası kullanıcıya gösterilecek üst sınır. */
const GOSTERILECEK = 6;

const istekSemasi = z.object({ kind: z.enum(["manga", "media"]) });

/** Karşılaştırma için ad sadeleştirme — "Vinland Saga" ≡ "vinland saga". */
function anahtar(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

export async function POST(request: Request) {
  const limit = checkRateLimit(clientKey(request, "recommend"), 10, 300_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Çok sık öneri istedin. Biraz bekle." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });
  }

  if (!openRouterStatus().configured) {
    return NextResponse.json({ error: "AI yapılandırılmamış." }, { status: 503 });
  }

  const parsed = istekSemasi.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const { kind } = parsed.data;

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Sunucu yapılandırılmamış." }, { status: 503 });
  }

  /*
   * Kütüphane istemciden DEĞİL sunucudan okunuyor: istemcinin gönderdiği
   * listeye güvenmek, isteğe istediği kadar büyük bir metin koyup token
   * harcatmasına açık kapı bırakırdı.
   */
  const sahipOlunan = new Set<string>();
  let kutuphaneMetni = "";

  if (kind === "manga") {
    const { data } = await admin
      .from("mangas")
      .select("name, rating, status, current_chapter")
      .eq("user_id", userId)
      .limit(200);

    const rows = data ?? [];
    for (const row of rows) sahipOlunan.add(anahtar(String(row.name)));
    kutuphaneMetni = rows
      .map(
        (row) =>
          `- ${row.name} (puan: ${row.rating ?? "?"}/10, ${row.status === "completed" ? "bitti" : "okuyor"}, bölüm ${row.current_chapter})`,
      )
      .join("\n");
  } else {
    const { data } = await admin
      .from("media_entries")
      .select("title, media_type, rating, status, release_year")
      .eq("user_id", userId)
      .limit(200);

    const rows = data ?? [];
    for (const row of rows) sahipOlunan.add(anahtar(String(row.title)));
    kutuphaneMetni = rows
      .map(
        (row) =>
          `- ${row.title} (${row.media_type === "movie" ? "film" : "dizi"}${row.release_year ? `, ${row.release_year}` : ""}, puan: ${row.rating ?? "?"}/10, durum: ${row.status})`,
      )
      .join("\n");
  }

  if (sahipOlunan.size === 0) {
    return NextResponse.json({
      recommendations: [],
      note:
        kind === "manga"
          ? "Önce birkaç manga ekle — öneri için neyi sevdiğini bilmem gerekiyor."
          : "Önce birkaç dizi/film ekle — öneri için neyi sevdiğini bilmem gerekiyor.",
      dropped: 0,
    });
  }

  // ------------------------------------------------------------ AI çağrısı

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  request.signal.addEventListener("abort", () => controller.abort());

  let oneri: z.infer<typeof recommendationResultSchema>;
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openRouterKey()}`,
        "Content-Type": "application/json",
        "X-Title": "Bitig Öneri",
      },
      body: JSON.stringify({
        model: env.projectModel(),
        temperature: 0.7, // öneride tek doğru yok; biraz çeşitlilik iyi
        max_tokens: 1600,
        messages: [
          {
            role: "system",
            content: `${AI_SECURITY_PREAMBLE}\n\n${buildRecommendPrompt(kind)}`,
          },
          { role: "user", content: `<kutuphane>\n${kutuphaneMetni}\n</kutuphane>` },
        ],
        response_format: { type: "json_schema", json_schema: RECOMMEND_JSON_SCHEMA },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Öneri alınamadı." }, { status: 502 });
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "AI boş yanıt döndü." }, { status: 502 });
    }

    const dogrulanmis = recommendationResultSchema.safeParse(JSON.parse(content));
    if (!dogrulanmis.success) {
      return NextResponse.json({ error: "AI beklenen biçimde yanıt vermedi." }, { status: 502 });
    }
    oneri = dogrulanmis.data;
  } catch {
    return NextResponse.json({ error: "Öneri alınamadı." }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }

  // ------------------------------------------------- Katalogda doğrulama

  /*
   * Tür MODELE SORULMUYOR, çağıran taraftan geliyor.
   *
   * Model manga önerilerine `kind: "series"` diyordu — muhtemelen "webtoon
   * serisi" anlamında. Bunlar dizi kataloğunda (TVMaze) aranıp haklı olarak
   * eleniyordu: 12 öneriden 10'u kayboluyordu ve kullanıcıya "öneri
   * çalışmıyor" gibi görünüyordu.
   *
   * Manga isteğinde tür kesin. Dizi/film isteğinde model hâlâ ikisi arasında
   * seçim yapıyor — orada gerçekten bilgi katıyor — ama "manga" derse o öneri
   * elenir, çünkü istenen o değil.
   */
  const adaylar = oneri.suggestions
    .filter((item) => !sahipOlunan.has(anahtar(item.title)))
    .map((item) =>
      kind === "manga"
        ? { ...item, kind: "manga" as const }
        : item,
    )
    .filter((item) => (kind === "manga" ? true : item.kind !== "manga"))
    .slice(0, 10);

  const dogrulananlar = await Promise.all(
    adaylar.map(async (item) => {
      const catalog: CatalogItem | null = await verifyInCatalog(
        item.kind,
        item.title,
        controller.signal,
      );
      return catalog ? { ...item, catalog } : null;
    }),
  );

  const sonuc = dogrulananlar
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .slice(0, GOSTERILECEK);

  return NextResponse.json({
    recommendations: sonuc,
    note: oneri.note,
    /*
     * Kaç önerinin katalogda doğrulanamadığı. Arayüz bunu gösteriyor:
     * sessizce elemek, AI'nın 8 öneri verip 3'ünün görünmesini açıklanamaz
     * kılardı.
     */
    dropped: adaylar.length - sonuc.length,
  });
}
