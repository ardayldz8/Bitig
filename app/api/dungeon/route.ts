import { NextRequest, NextResponse } from "next/server";
import { aiGenerate, hasAiKey } from "@/lib/ai";
import { getUserId } from "@/lib/server-auth";
import type { Entry, Goal } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const SYSTEM_PROMPT = `Sen "Bitig" uygulamasının Solo Leveling temalı "Zindan" (dungeon) üreticisisin. Kullanıcının alışkanlıklarına ve hedeflerine bakıp, onu zorlayacak ama ulaşılabilir, çok adımlı bir meydan okuma üret.

ÇIKTI — yalnızca şu JSON (başka metin yok):
{"name":"...", "rank":"E|D|C|B|A|S", "boss":"...", "steps":["...","...","..."]}

- "name": Temalı, havalı Türkçe zindan adı (ör. "Demir İrade Zindanı", "Şafak Geçidi").
- "rank": Zorluğa göre E (kolay) → S (çok zor).
- "boss": Zindanın sonundaki ana meydan okuma/ödülü anlatan kısa, motive edici cümle.
- "steps": 3-5 adet SOMUT, ölçülebilir, kullanıcının verisine uygun adım (ör. "3 gün üst üste 30 dk spor", "1 hafta şekersiz", "her gün 2L su"). Türkçe ve kısa.

Türkçe karakterleri koru. Yalnızca geçerli JSON.`;

function compact(entries: Entry[]) {
  return entries.slice(0, 60).map((e) => {
    switch (e.kind) {
      case "habit":
        return { kind: "habit", name: e.name, done: e.done };
      case "task":
        return { kind: "task", title: e.title, done: e.done };
      case "food":
        return { kind: "food", name: e.name };
      case "mood":
        return { kind: "mood", score: e.score };
      default:
        return { kind: e.kind };
    }
  });
}

const FALLBACK = {
  name: "Disiplin Zindanı",
  rank: "D",
  boss: "Bir hafta boyunca rutinini hiç aksatmadan ayakta kal",
  steps: [
    "3 gün üst üste spor yap",
    "Her gün en az 2 litre su iç",
    "1 hafta erken kalk",
    "Her akşam günlüğünü yaz",
  ],
};

function validate(o: unknown) {
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  const steps = Array.isArray(r.steps)
    ? r.steps.map((s) => String(s).trim()).filter(Boolean).slice(0, 6)
    : [];
  if (typeof r.name !== "string" || !r.name.trim() || steps.length < 2) return null;
  const rank = typeof r.rank === "string" && /^[EDCBAS]$/.test(r.rank.trim()) ? r.rank.trim() : "D";
  return {
    name: r.name.trim(),
    rank,
    boss: typeof r.boss === "string" ? r.boss.trim() : "",
    steps,
  };
}

export async function POST(req: NextRequest) {
  if (!(await getUserId(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let entries: Entry[] = [];
  let goals: Goal[] = [];
  let today = "";
  try {
    const body = await req.json();
    if (Array.isArray(body?.entries)) entries = body.entries as Entry[];
    if (Array.isArray(body?.goals)) goals = body.goals as Goal[];
    today = String(body?.today ?? "");
  } catch {
    // gövde okunamadı
  }

  if (!hasAiKey()) return NextResponse.json(FALLBACK);

  try {
    const out = await aiGenerate({
      system: SYSTEM_PROMPT,
      user:
        `Bugün: ${today}.\nKullanıcının son kayıtları (JSON):\n` +
        JSON.stringify(compact(entries)) +
        "\nHedefleri: " +
        JSON.stringify(goals ?? []) +
        "\n\nBuna uygun, kişiye özel bir zindan üret.",
      json: true,
      temperature: 0.8,
    });
    if (!out) throw new Error("empty");
    const parsed = JSON.parse(out);
    return NextResponse.json(validate(parsed) ?? FALLBACK);
  } catch {
    return NextResponse.json(FALLBACK);
  }
}
