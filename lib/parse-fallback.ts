import type { ParsedItem } from "./types";

/**
 * Yapay zeka anahtarı yokken / çevrimdışıyken kullanılan basit kural tabanlı
 * Türkçe ayrıştırıcı. AI route'u kadar iyi değildir ama uygulamayı anahtarsız
 * da kullanılabilir kılar.
 */

const MOOD_WORDS: Record<string, number> = {
  harika: 5,
  mükemmel: 5,
  mutlu: 5,
  enerjik: 5,
  "çok iyi": 5,
  huzurlu: 4,
  keyifli: 4,
  iyi: 4,
  rahat: 4,
  normal: 3,
  idare: 3,
  ortalama: 3,
  yorgun: 2,
  dağınık: 2,
  stresli: 2,
  gergin: 2,
  bunalmış: 2,
  kötü: 1,
  üzgün: 1,
  bitkin: 1,
  mutsuz: 1,
  berbat: 1,
};

// ipucu -> düzgün alışkanlık adı
const HABIT_HINTS: { match: RegExp; name: string }[] = [
  { match: /koş|jogging/i, name: "koşu" },
  { match: /yürü/i, name: "yürüyüş" },
  { match: /spor|antren|gym|fitness/i, name: "spor" },
  { match: /yoga|medita/i, name: "meditasyon" },
  { match: /\bsu\b/i, name: "su" },
  { match: /kitap|oku/i, name: "okuma" },
  { match: /ders|çalış|study/i, name: "çalışma" },
  { match: /uyku|uyu/i, name: "uyku" },
  { match: /diş/i, name: "diş fırçalama" },
  { match: /vitamin|ilaç/i, name: "vitamin" },
];

const TASK_HINTS = /lazım|gerek|yapmalı|almalı|halletmeli|todo|yapılacak|-?cak\b|-?cek\b|unutma/i;

function detectAmount(text: string): { amount?: number; unit?: string } {
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*(saat|saati|dakika|dk|bardak|litre|sayfa|km|adım|kez|defa)/i);
  if (!m) return {};
  const amount = parseFloat(m[1].replace(",", "."));
  let unit = m[2].toLowerCase();
  if (unit === "dakika") unit = "dk";
  if (unit === "saati") unit = "saat";
  if (unit === "defa") unit = "kez";
  return { amount, unit };
}

function classifyClause(clause: string): ParsedItem | null {
  const text = clause.trim();
  if (!text) return null;
  const lower = text.toLocaleLowerCase("tr");

  // 1) Ruh hali
  for (const [word, score] of Object.entries(MOOD_WORDS)) {
    if (lower.includes(word)) {
      return { kind: "mood", score, label: word, note: text };
    }
  }

  // 2) Alışkanlık (ipucu veya süre/miktar içeriyorsa)
  const { amount, unit } = detectAmount(text);
  for (const h of HABIT_HINTS) {
    if (h.match.test(lower)) {
      return { kind: "habit", name: h.name, amount, unit, done: true };
    }
  }
  if (amount !== undefined) {
    // miktar var ama tanınan alışkanlık yok -> yine de alışkanlık say
    return { kind: "habit", name: text.replace(/\d+.*/, "").trim() || "aktivite", amount, unit, done: true };
  }

  // 3) Görev
  if (TASK_HINTS.test(lower)) {
    return { kind: "task", title: text, done: false };
  }

  // 4) Serbest günlük
  return { kind: "journal", text };
}

export function fallbackParse(input: string): ParsedItem[] {
  const clauses = input
    .split(/[,;\n]|\bve\b|\bsonra\b|\bardından\b/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const items: ParsedItem[] = [];
  for (const c of clauses) {
    const item = classifyClause(c);
    if (item) items.push(item);
  }

  // hiçbir şey çıkmadıysa tüm metni günlük olarak kaydet
  if (items.length === 0 && input.trim()) {
    items.push({ kind: "journal", text: input.trim() });
  }
  return items;
}
