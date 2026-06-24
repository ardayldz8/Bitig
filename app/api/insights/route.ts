import { NextRequest, NextResponse } from "next/server";
import type { Entry } from "@/lib/types";
import { aiGenerate } from "@/lib/ai";

export const runtime = "nodejs";

// Modeller lib/gemini.ts içindeki DEFAULT_MODELS'ten gelir (yedek zinciri).

const SYSTEM_PROMPT = `Sen "Bitig" uygulamasının yapay zeka koçusun. Kullanıcının son günlerdeki kayıtlarını (alışkanlık, görev, ruh hali, günlük, beslenme) JSON olarak alırsın. Kısa, sıcak ve işe yarar bir Türkçe özet yaz.

Biçim (Markdown, kısa tut):
**Özet:** Genel durumu 1-2 cümlede anlat.

**Örüntüler:**
- Dikkat çeken 2-3 trend (artış/azalış, seriler, eksik kalan alışkanlıklar, ruh hali ile aktivite ilişkisi).

**Öneri:** Tek bir somut, küçük, uygulanabilir öneri.

Kurallar: Veriye dayan, abartma, yargılama. En fazla ~150 kelime. Motive edici ama gerçekçi ol. Veri azsa bunu nazikçe belirt.`;

/** Kayıtları modele göndermek için kompakt forma indirger. */
function compact(entries: Entry[]) {
  return entries.slice(0, 200).map((e) => {
    switch (e.kind) {
      case "habit":
        return { d: e.date, t: "habit", name: e.name, amount: e.amount, unit: e.unit, done: e.done };
      case "task":
        return { d: e.date, t: "task", title: e.title, done: e.done };
      case "mood":
        return { d: e.date, t: "mood", score: e.score, label: e.label };
      case "journal":
        return { d: e.date, t: "journal", text: e.text.slice(0, 200) };
      case "food":
        return { d: e.date, t: "food", name: e.name, kcal: e.kcal };
    }
  });
}

/** AI yokken basit istatistiksel özet üretir. */
function localSummary(entries: Entry[]): string {
  if (!entries.length) {
    return "Henüz özetlenecek kayıt yok. Birkaç gün kayıt tuttuktan sonra burada örüntüler ve öneriler göreceksin.";
  }
  const habits = entries.filter((e) => e.kind === "habit").length;
  const tasks = entries.filter((e) => e.kind === "task");
  const doneTasks = tasks.filter((e) => e.kind === "task" && e.done).length;
  const moods = entries.filter((e) => e.kind === "mood") as Extract<Entry, { kind: "mood" }>[];
  const avgMood = moods.length
    ? (moods.reduce((s, m) => s + m.score, 0) / moods.length).toFixed(1)
    : null;
  const days = new Set(entries.map((e) => e.date)).size;

  const lines = [
    `**Özet:** Son ${days} günde toplam ${entries.length} kayıt tuttun.`,
    "",
    "**Örüntüler:**",
    `- ${habits} alışkanlık kaydı.`,
    `- ${tasks.length} görevden ${doneTasks} tanesi tamamlandı.`,
    avgMood ? `- Ortalama ruh hali: ${avgMood}/5.` : null,
    "",
    "**Öneri:** Yapay zeka özetini açmak için sunucuya bir GEMINI_API_KEY ekle — o zaman gerçek örüntü analizi ve kişisel öneriler alırsın.",
  ].filter(Boolean);
  return lines.join("\n");
}

/** Gemini ile içgörü. Anahtar yoksa null döner. */
async function geminiInsight(entries: Entry[]): Promise<string | null> {
  return aiGenerate({
    system: SYSTEM_PROMPT,
    user:
      "Son kayıtlarım (JSON):\n" +
      JSON.stringify(compact(entries)) +
      "\n\nBunları analiz edip özet çıkar.",
    temperature: 0.6,
  });
}

export async function POST(req: NextRequest) {
  let entries: Entry[] = [];
  try {
    const body = await req.json();
    if (Array.isArray(body?.entries)) entries = body.entries as Entry[];
  } catch {
    // gövde okunamadı
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ summary: localSummary(entries) });
  }

  try {
    const summary = await geminiInsight(entries);
    return NextResponse.json({ summary: summary ?? localSummary(entries) });
  } catch {
    return NextResponse.json({ summary: localSummary(entries) });
  }
}
