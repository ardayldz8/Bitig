import type { Entry, ParsedItem } from "./types";

const KEY = "duzen.entries.v1";

export function loadEntries(): Entry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Entry[]) : [];
  } catch {
    return [];
  }
}

export function saveEntries(entries: Entry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // depolama dolu / erişilemez — sessiz geç
  }
}

export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Kaydın saatini "HH:mm" verir. */
export function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

/** Bir kaydın metinsel özü (dedup/gösterim için). */
export function entryText(e: Entry): string {
  switch (e.kind) {
    case "habit":
      return e.name;
    case "task":
      return e.title;
    case "mood":
      return e.note || e.label || "";
    case "journal":
      return e.text;
    case "food":
      return e.name;
  }
}

function normText(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** İki metnin token-Jaccard benzerliği (0-1). Mükerrer tespiti için. */
export function similar(a: string, b: string): number {
  const ta = new Set(normText(a).split(" ").filter(Boolean));
  const tb = new Set(normText(b).split(" ").filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  ta.forEach((t) => {
    if (tb.has(t)) inter++;
  });
  return inter / (ta.size + tb.size - inter);
}

/** Ham ayrıştırma öğesini tam bir Entry'ye dönüştürür. */
export function itemToEntry(item: ParsedItem, sourceText?: string): Entry {
  const base = {
    id: uid(),
    createdAt: new Date().toISOString(),
    date: dayKey(),
    sourceText,
  };
  switch (item.kind) {
    case "habit":
      return {
        ...base,
        kind: "habit",
        name: item.name,
        amount: item.amount,
        unit: item.unit,
        done: item.done ?? true,
      };
    case "task":
      return { ...base, kind: "task", title: item.title, done: item.done ?? false };
    case "mood":
      return { ...base, kind: "mood", score: item.score, label: item.label, note: item.note };
    case "journal":
      return { ...base, kind: "journal", text: item.text };
    case "food":
      return {
        ...base,
        kind: "food",
        name: item.name,
        amount: item.amount,
        unit: item.unit,
        kcal: item.kcal,
        protein: item.protein,
        carb: item.carb,
        fat: item.fat,
      };
  }
}
