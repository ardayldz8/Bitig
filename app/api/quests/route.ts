import { NextRequest, NextResponse } from "next/server";
import { aiGenerate, hasAiKey } from "@/lib/ai";
import { getUserId } from "@/lib/server-auth";
import type { Entry, ParsedItem, QuestSpec, QuestStat } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const STATS: QuestStat[] = ["STR", "INT", "VIT", "DEX"];

const SYSTEM_PROMPT = `Sen "Bitig System"sin — Solo Leveling tarzı kişisel gelişim sistemi. Kullanıcının son kayıtlarına bakarak BUGÜN için tam 3 kısa, somut ve ulaşılabilir "günlük quest" üret. Questler kullanıcının mevcut alışkanlıklarına/ilgisine uysun, abartılı zor olmasın.

Her quest bir stat geliştirir:
- STR: fiziksel (spor, koşu, yürüyüş, antrenman)
- INT: zihinsel (okuma, ders, çalışma, öğrenme)
- VIT: sağlık/rutin (su, uyku, meditasyon, vitamin)
- DEX: üretkenlik (bir görevi tamamlamak)

Çıktı SADECE şu JSON:
{"quests":[{"text":"⚔️ kısa quest","stat":"STR","item":{...}}]}

"item" = quest tamamlanınca kaydedilecek kayıt:
- fiziksel/zihinsel/sağlık questi -> {"kind":"habit","name":"koşu","amount":30,"unit":"dk","done":true}
- görev questi -> {"kind":"task","title":"...","done":true}

Kurallar: item.name/title quest'in stat'ıyla tutarlı olsun. Tam 3 quest. Metinler Türkçe ve emojiyle başlasın. Yalnızca geçerli JSON döndür.`;

const FALLBACK: QuestSpec[] = [
  { text: "📖 10 sayfa kitap oku", stat: "INT", item: { kind: "habit", name: "okuma", amount: 10, unit: "sayfa", done: true } },
  { text: "🏃 20 dk yürüyüş yap", stat: "STR", item: { kind: "habit", name: "yürüyüş", amount: 20, unit: "dk", done: true } },
  { text: "💧 2 litre su iç", stat: "VIT", item: { kind: "habit", name: "su", amount: 2, unit: "litre", done: true } },
];

function normItem(o: unknown): ParsedItem | null {
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  if (r.kind === "habit" && typeof r.name === "string" && r.name.trim()) {
    return {
      kind: "habit",
      name: r.name.trim(),
      amount: typeof r.amount === "number" ? r.amount : undefined,
      unit: typeof r.unit === "string" ? r.unit : undefined,
      done: true,
    };
  }
  if (r.kind === "task" && typeof r.title === "string" && r.title.trim()) {
    return { kind: "task", title: r.title.trim(), done: true };
  }
  return null;
}

function validateQuests(raw: unknown): QuestSpec[] {
  if (!Array.isArray(raw)) return [];
  const out: QuestSpec[] = [];
  for (const q of raw) {
    if (!q || typeof q !== "object") continue;
    const o = q as Record<string, unknown>;
    const item = normItem(o.item);
    const stat = typeof o.stat === "string" ? (o.stat.toUpperCase() as QuestStat) : null;
    if (typeof o.text === "string" && o.text.trim() && item && stat && STATS.includes(stat)) {
      out.push({ text: o.text.trim(), stat, item });
    }
    if (out.length >= 3) break;
  }
  return out;
}

function compact(entries: Entry[]) {
  return entries.slice(0, 80).map((e) => {
    if (e.kind === "habit") return { kind: "habit", name: e.name, date: e.date };
    if (e.kind === "task") return { kind: "task", title: e.title, done: e.done, date: e.date };
    if (e.kind === "mood") return { kind: "mood", label: e.label, date: e.date };
    if (e.kind === "food") return { kind: "food", name: e.name, kcal: e.kcal, date: e.date };
    return { kind: "journal", date: e.date };
  });
}

export async function POST(req: NextRequest) {
  if (!(await getUserId(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let entries: Entry[] = [];
  let today = "";
  try {
    const body = await req.json();
    if (Array.isArray(body?.entries)) entries = body.entries as Entry[];
    today = String(body?.today ?? "");
  } catch {
    // gövde okunamadı
  }

  if (!hasAiKey()) {
    return NextResponse.json({ quests: FALLBACK });
  }

  try {
    const out = await aiGenerate({
      system: SYSTEM_PROMPT,
      user:
        `Bugün: ${today}.\nKullanıcının son kayıtları (JSON):\n` +
        JSON.stringify(compact(entries)) +
        "\n\nBuna göre bugüne 3 quest üret.",
      json: true,
      temperature: 0.7,
    });
    if (!out) throw new Error("empty");
    const parsed = JSON.parse(out);
    const quests = validateQuests(parsed?.quests);
    return NextResponse.json({ quests: quests.length === 3 ? quests : FALLBACK });
  } catch {
    return NextResponse.json({ quests: FALLBACK });
  }
}
