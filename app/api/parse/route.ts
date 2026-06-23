import { NextRequest, NextResponse } from "next/server";
import { fallbackParse } from "@/lib/parse-fallback";
import { aiGenerate } from "@/lib/ai";
import type { ParsedItem, ParseResponse } from "@/lib/types";

export const runtime = "nodejs";

// Modeller lib/gemini.ts içindeki DEFAULT_MODELS'ten gelir (yedek zinciri).

const SYSTEM_PROMPT = `Sen "Bitig" adlı kişisel takip uygulamasının ayrıştırıcısısın. Kullanıcı gününü gündelik Türkçe ile yazar. Metni anlamlı parçalara böl ve her parçayı bir türe ata.

Çıktıyı SADECE şu JSON biçiminde ver:
{"items": [ { "kind": "...", ... } ]}

Her öğe için "kind" zorunludur ve şunlardan biri olur:
- "habit": Tekrar eden/ölçülebilir aktiviteler (spor, koşu, su, okuma, uyku, ders, meditasyon...). Alanlar: "name" (zorunlu, kısa ve normalize ad, ör. "koşu", "su", "okuma", "çalışma"), "amount" (sayı, opsiyonel), "unit" (ör. "dk", "saat", "bardak", "sayfa", "km"; opsiyonel), "done" (boolean; yapılmışsa true).
- "task": Yapılması gereken/planlanan, henüz yapılmamış işler. Alanlar: "title" (zorunlu), "done" (boolean; kullanıcı yaptım/bitirdim demediyse false).
- "mood": Ruh hali/enerji. Alanlar: "score" (1-5 tam sayı; 1 çok kötü, 3 nötr, 5 çok iyi), "label" (tek kelime, ör. "yorgun", "mutlu", "dağınık"), "note" (kısa metin).
- "journal": Yukarıdakilere girmeyen serbest notlar. Alanlar: "text" (zorunlu).

Kurallar: Bir cümlede birden fazla öğe olabilir; hepsini ayrı çıkar. Türkçe karakterleri ve kullanıcının ifadesini koru. Emin değilsen journal olarak ekle. Yalnızca geçerli JSON döndür, başka metin yazma.`;

function clampScore(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 3;
  return Math.min(5, Math.max(1, v));
}

/** Modelin döndürdüğü ham öğeleri güvenli ParsedItem[]'e çevirir. */
function normalizeItems(raw: unknown): ParsedItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ParsedItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    switch (o.kind) {
      case "habit":
        if (typeof o.name === "string" && o.name.trim()) {
          out.push({
            kind: "habit",
            name: o.name.trim(),
            amount: typeof o.amount === "number" ? o.amount : undefined,
            unit: typeof o.unit === "string" ? o.unit : undefined,
            done: typeof o.done === "boolean" ? o.done : true,
          });
        }
        break;
      case "task":
        if (typeof o.title === "string" && o.title.trim()) {
          out.push({ kind: "task", title: o.title.trim(), done: typeof o.done === "boolean" ? o.done : false });
        }
        break;
      case "mood":
        out.push({
          kind: "mood",
          score: clampScore(o.score),
          label: typeof o.label === "string" ? o.label : undefined,
          note: typeof o.note === "string" ? o.note : undefined,
        });
        break;
      case "journal":
        if (typeof o.text === "string" && o.text.trim()) {
          out.push({ kind: "journal", text: o.text.trim() });
        }
        break;
    }
  }
  return out;
}

/** Gemini ile ayrıştırma. Anahtar yoksa null döner. */
async function geminiParse(text: string): Promise<ParsedItem[] | null> {
  const out = await aiGenerate({
    system: SYSTEM_PROMPT,
    user: text,
    json: true,
    temperature: 0.2,
  });
  if (out == null) return null; // anahtar yok
  const parsed = JSON.parse(out);
  return normalizeItems(parsed?.items);
}

export async function POST(req: NextRequest) {
  let text = "";
  try {
    const body = await req.json();
    text = String(body?.text ?? "");
  } catch {
    // gövde okunamadı
  }

  if (!text.trim()) {
    return NextResponse.json({ items: [], source: "fallback" } satisfies ParseResponse);
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ items: fallbackParse(text), source: "fallback" } satisfies ParseResponse);
  }

  try {
    const items = await geminiParse(text);
    if (!items || !items.length) {
      return NextResponse.json({ items: fallbackParse(text), source: "fallback" } satisfies ParseResponse);
    }
    return NextResponse.json({ items, source: "ai" } satisfies ParseResponse);
  } catch {
    return NextResponse.json({ items: fallbackParse(text), source: "fallback" } satisfies ParseResponse);
  }
}
