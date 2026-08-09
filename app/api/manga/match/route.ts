import { NextResponse } from "next/server";
import { z } from "zod";
import { generateStructured, ProjectAiError } from "@/lib/ai/project-assistant";
import { searchMangaCandidates, type MangaCandidate } from "@/lib/catalog/manga-search";
import { openRouterStatus } from "@/lib/env";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { getUserId } from "@/lib/supabase/server";

export const runtime = "nodejs";

const istekSemasi = z.object({ title: z.string().min(1).max(200) });

const ceviriSemasi = z.object({
  queries: z.array(z.string().min(1).max(150)).min(1).max(4),
});

const CEVIRI_JSON_SCHEMA = {
  name: "manga_title_queries",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["queries"],
    properties: {
      queries: { type: "array", items: { type: "string" }, maxItems: 4 },
    },
  },
} as const;

const CEVIRI_PROMPT = `Türkçe çevrilmiş bir manga/manhwa adını, katalogda
aranabilecek ADLARA çevirirsin.

MangaDex özgün ve İngilizce adlarla indeksli; Türkçe adla arama sonuç
vermiyor. Ölçüldü: 8 Türkçe addan yalnızca 1'i eşleşti, o da yanlış esere.

Kurallar:
- En olası İNGİLİZCE adı başa koy. Çoğu Kore webtoon'unun resmî İngilizce
  adı var; onu kullan.
- Biliyorsan romanize Korece/Japonca adı da ekle.
- Emin değilsen birebir çeviri yerine ANLAMCA karşılık gelen adı dene;
  "Akademinin Dehası" için "Genius of the Academy" gibi.
- En fazla 4 aday. Uydurma ad üretme, emin olmadığın varyasyonları ekleme.

Yalnızca arama metinleri döndür, açıklama yazma.`;

/**
 * Türkçe manga adı için katalog adayları.
 *
 * İki aşama: AI adı aranabilir hâle çevirir, katalog gerçek kayıtları döner.
 * AI hiçbir zaman "bu eser şudur" demiyor — yalnızca arama metni üretiyor,
 * eşleştirmeyi kullanıcı onaylıyor.
 */
export async function POST(request: Request) {
  const limit = checkRateLimit(clientKey(request, "manga-match"), 40, 300_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Çok sık istek. Biraz bekle." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });
  }

  const parsed = istekSemasi.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const { title } = parsed.data;

  // Sorgular: önce kullanıcının yazdığı ad (bazıları zaten İngilizce olabilir)
  const sorgular: string[] = [title];

  if (openRouterStatus().configured) {
    try {
      const ceviri = await generateStructured<z.infer<typeof ceviriSemasi>>({
        systemPrompt: CEVIRI_PROMPT,
        userPrompt: `Türkçe ad: ${title}`,
        jsonSchema: CEVIRI_JSON_SCHEMA,
        schema: ceviriSemasi,
        signal: request.signal,
      });
      sorgular.push(...ceviri.queries);
    } catch (error) {
      /*
       * AI yoksa ya da yavaşsa akış durmuyor: kullanıcının yazdığı adla
       * arama yine yapılıyor ve sonuç boşsa arama kutusundan kendisi
       * deneyebiliyor. Eşleştirme AI'ya bağımlı olmamalı.
       */
      if (!(error instanceof ProjectAiError)) throw error;
    }
  }

  const gorulen = new Set<string>();
  const adaylar: MangaCandidate[] = [];

  /*
   * TÜM sorgular çalıştırılıyor, erken çıkış YOK.
   *
   * Önce "yeterince aday bulundu" diye döngü kesiliyordu ve doğru sorguya
   * sıra gelmiyordu: "4000 Yılın Ardından Dönen Kadim Büyücü" için AI'nın
   * 3. önerisi doğruydu ama ilk iki sorgu listeyi 8 alakasız adayla
   * doldurup döngüyü bitiriyordu.
   */
  for (const sorgu of sorgular.slice(0, 4)) {
    const sonuc = await searchMangaCandidates(sorgu, request.signal);
    for (const aday of sonuc) {
      if (gorulen.has(aday.id)) continue;
      gorulen.add(aday.id);
      adaylar.push(aday);
    }
  }

  return NextResponse.json({
    queries: sorgular.slice(0, 4),
    candidates: adaylar.slice(0, 12),
  });
}
