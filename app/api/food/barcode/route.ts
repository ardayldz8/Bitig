import { NextResponse } from "next/server";
import { barcodeRequestSchema } from "@/lib/calorie/validation";
import { configuredProviders } from "@/lib/nutrition/provider";
import { resolveByBarcode } from "@/lib/nutrition/search-nutrition";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import type { ResolvedNutrition } from "@/types/calorie";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const limit = checkRateLimit(clientKey(request, "barcode"), 30, 60_000);
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

  const parsed = barcodeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz barkod." }, { status: 400 });
  }

  if (configuredProviders().length === 0) {
    return NextResponse.json({ match: null }, { status: 200 });
  }

  try {
    const found = await resolveByBarcode(parsed.data.barcode, request.signal);
    if (!found) {
      return NextResponse.json({ match: null });
    }

    const match: ResolvedNutrition = {
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
    };

    return NextResponse.json({ match });
  } catch {
    return NextResponse.json({ error: "Barkod sorgulanamadı." }, { status: 502 });
  }
}
