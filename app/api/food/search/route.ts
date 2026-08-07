import { NextResponse } from "next/server";
import { searchRequestSchema } from "@/lib/calorie/validation";
import { configuredProviders } from "@/lib/nutrition/provider";
import { resolveNutritionDetailed } from "@/lib/nutrition/search-nutrition";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import type { ResolvedNutrition } from "@/types/calorie";

export const runtime = "nodejs";
export const maxDuration = 60;

export type SearchMatch = {
  name: string;
  match: ResolvedNutrition | null;
};

export async function POST(request: Request) {
  const limit = checkRateLimit(clientKey(request, "search"), 30, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Çok fazla istek gönderdin. Biraz bekleyip tekrar dene." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const parsed = searchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "İstek doğrulanamadı." }, { status: 400 });
  }

  const available = configuredProviders();
  if (available.length === 0) {
    return NextResponse.json(
      {
        matches: parsed.data.items.map((item) => ({ name: item.name, match: null })),
        providers: [],
        warning:
          "Hiçbir besin veri kaynağı yapılandırılmamış. Değerleri manuel girebilirsin.",
      },
      { status: 200 },
    );
  }

  const matches: SearchMatch[] = [];
  let anyUnavailable = false;

  for (const item of parsed.data.items) {
    const queries = item.queries.length > 0 ? item.queries : [item.name];
    const { result: found, unavailable } = await resolveNutritionDetailed({
      queries,
      brand: item.brand,
      barcode: item.barcode,
      kind: item.kind,
    }, request.signal);

    if (unavailable) anyUnavailable = true;

    matches.push({
      name: item.name,
      match: found
        ? {
            source: found.provider,
            foodId: found.foodId,
            name: found.name,
            brand: found.brand,
            caloriesPer100: found.per100.caloriesPer100,
            proteinPer100: found.per100.proteinPer100,
            carbohydratesPer100: found.per100.carbohydratesPer100,
            fatPer100: found.per100.fatPer100,
            basis: found.per100.basis,
            servingGrams: found.servingGrams,
          }
        : null,
    });
  }

  // Eşleşme YOK ve kaynağa erişilemedi → bu "bulunamadı" değil, "şu anda
  // bakılamadı". İkisini aynı göstermek özelliği bozuk sandırıyor.
  const hicEslesmeYok = matches.every((item) => item.match === null);

  return NextResponse.json({
    matches,
    providers: available,
    ...(anyUnavailable && hicEslesmeYok
      ? {
          warning:
            "Besin veri kaynağı şu anda yanıt vermiyor (istek sınırı). Birkaç dakika sonra tekrar dene ya da değerleri manuel gir.",
        }
      : {}),
  });
}
