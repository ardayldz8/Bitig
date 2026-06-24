import { NextRequest, NextResponse } from "next/server";
import { aiGenerate, hasAiKey } from "@/lib/ai";
import type { Entry, Facet } from "@/lib/types";

export const runtime = "nodejs";

const KINDS = ["habit", "task", "mood", "journal", "food"];

const SYSTEM_PROMPT = `Sen "Bitig"in geçmiş kayıt analizcisisin. Kullanıcının geçmiş kayıtlarına bakıp onları süzmek için EN FAZLA 5 ANLAMLI, KİŞİYE ÖZEL ve BİRBİRİYLE ÖRTÜŞMEYEN filtre ("facet") üret. Genel/boş kategoriler değil — kullanıcının GERÇEKTE tuttuğu şeylere göre grupla; yeni temalar gördükçe yeni filtreler öner. Aynı konuyu ikiye bölme (ör. "Spor" ile "Yüzme"yi ayrı yapma; tek "Spor" yeter).

Her facet: kısa Türkçe etiket + tek emoji + eşleşme kuralı (kinds ve/veya keywords):
- kinds: şu türlerden hangileri bu gruba girer -> ["habit","task","mood","journal","food"]
- keywords: kaydın metninde geçerse gruba dahil eden küçük harfli kelime kökleri

Örnekler (kullanıcının verisine göre seç): çok spor varsa {"label":"Spor","emoji":"🏃","kinds":["habit"],"keywords":["koş","spor","yürü","antren","gym"]}; yemek varsa {"label":"Beslenme","emoji":"🍽️","kinds":["food"]}; ders/kod/okuma varsa {"label":"Çalışma","emoji":"📚","keywords":["ders","kod","oku","proje","çalış","öğren"]}; uyku/su/sağlık varsa {"label":"Sağlık","emoji":"💧","keywords":["uyku","su","vitamin","medita","nefes"]}.

ÇIKTI yalnızca JSON: {"facets":[{"label":"...","emoji":"...","kinds":[...],"keywords":[...]}]}. Türkçe karakterleri koru.`;

function compact(entries: Entry[]) {
  return entries.slice(0, 120).map((e) => {
    let text = "";
    switch (e.kind) {
      case "habit":
        text = e.name;
        break;
      case "task":
        text = e.title;
        break;
      case "mood":
        text = e.label || e.note || "";
        break;
      case "journal":
        text = e.text.slice(0, 80);
        break;
      case "food":
        text = e.name;
        break;
    }
    return { kind: e.kind, text };
  });
}

const FALLBACK: Facet[] = [
  { label: "Alışkanlık", emoji: "🔁", kinds: ["habit"], keywords: [] },
  { label: "Görev", emoji: "✅", kinds: ["task"], keywords: [] },
  { label: "Beslenme", emoji: "🍽️", kinds: ["food"], keywords: [] },
  { label: "Ruh hali", emoji: "💭", kinds: ["mood"], keywords: [] },
  { label: "Günlük", emoji: "📝", kinds: ["journal"], keywords: [] },
];

function validate(raw: unknown): Facet[] {
  if (!raw || typeof raw !== "object") return [];
  const arr = (raw as { facets?: unknown }).facets;
  if (!Array.isArray(arr)) return [];
  const out: Facet[] = [];
  for (const f of arr) {
    if (!f || typeof f !== "object") continue;
    const o = f as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label.trim() : "";
    if (!label) continue;
    const kinds = Array.isArray(o.kinds)
      ? (o.kinds.filter((k) => typeof k === "string" && KINDS.includes(k)) as string[])
      : [];
    const keywords = Array.isArray(o.keywords)
      ? o.keywords
          .map((k) => String(k).trim().toLocaleLowerCase("tr"))
          .filter(Boolean)
          .slice(0, 12)
      : [];
    if (!kinds.length && !keywords.length) continue;
    out.push({ label, emoji: typeof o.emoji === "string" ? o.emoji : undefined, kinds, keywords });
    if (out.length >= 6) break;
  }
  return out;
}

export async function POST(req: NextRequest) {
  let entries: Entry[] = [];
  try {
    const body = await req.json();
    if (Array.isArray(body?.entries)) entries = body.entries as Entry[];
  } catch {
    // gövde okunamadı
  }

  if (!entries.length || !hasAiKey()) {
    return NextResponse.json({ facets: FALLBACK });
  }

  try {
    const out = await aiGenerate({
      system: SYSTEM_PROMPT,
      user:
        "Kullanıcının geçmiş kayıtları (JSON):\n" +
        JSON.stringify(compact(entries)) +
        "\n\nBunlara uygun, kişiye özel filtreler üret.",
      json: true,
      temperature: 0.5,
    });
    if (!out) throw new Error("empty");
    const facets = validate(JSON.parse(out));
    return NextResponse.json({ facets: facets.length ? facets : FALLBACK });
  } catch {
    return NextResponse.json({ facets: FALLBACK });
  }
}
