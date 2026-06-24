import { NextRequest, NextResponse } from "next/server";
import { aiGenerate, hasAiKey } from "@/lib/ai";
import { getUserId } from "@/lib/server-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

const SYSTEM_PROMPT =
  "Sen bir beslenme veritabanısın. Verilen her yiyecek için BELİRTİLEN MİKTARIN TOPLAM kalori ve makrolarını (protein/karbonhidrat/yağ, gram) güncel web kaynaklarından araştır. Türk yemeklerinde Türkçe kaynakları (fatsecret.com.tr, kackalori.com.tr vb.) tercih et.";

export async function POST(req: NextRequest) {
  if (!(await getUserId(req))) return NextResponse.json({ results: [] }, { status: 401 });
  let items: { name?: string; amount?: number; unit?: string }[] = [];
  try {
    const body = await req.json();
    if (Array.isArray(body?.items)) items = body.items;
  } catch {
    // gövde okunamadı
  }

  if (!items.length || !hasAiKey()) return NextResponse.json({ results: [] });

  const list = items.map((f) =>
    `${f.amount ?? 1} ${f.unit ?? ""} ${f.name ?? ""}`.replace(/\s+/g, " ").trim()
  );

  try {
    const out = await aiGenerate({
      system: SYSTEM_PROMPT,
      user:
        `Yiyecekler (sırayla; her biri için belirtilen MİKTARIN TOPLAMINI ver):\n${JSON.stringify(list)}\n\n` +
        `SADECE şu JSON: {"items":[{"kcal":0,"protein":0,"carb":0,"fat":0}]} — sıra girdiyle birebir aynı olsun.`,
      json: true,
      web: true,
      temperature: 0.1,
    });
    if (!out) return NextResponse.json({ results: [] });
    const arr = JSON.parse(out)?.items;
    const numK = (v: unknown) => (typeof v === "number" && v > 0 ? Math.round(v) : undefined); // kcal: 0 = bulunamadı
    const numM = (v: unknown) => (typeof v === "number" && v >= 0 ? Math.round(v) : undefined); // makro: 0 geçerli
    const results = Array.isArray(arr)
      ? arr.map((r: Record<string, unknown>) => ({
          kcal: numK(r?.kcal),
          protein: numM(r?.protein),
          carb: numM(r?.carb),
          fat: numM(r?.fat),
        }))
      : [];
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
