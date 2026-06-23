import type { Entry } from "./types";

// "Solo Leveling System" temalı oyunlaştırma.
// XP biriken, geri alınmayan puan; Level her 100 XP; Rank E→S geniş kademeler.

const XP_PER_LEVEL = 100;

const RANKS = [
  { min: 0, rank: "E" },
  { min: 250, rank: "D" },
  { min: 600, rank: "C" },
  { min: 1200, rank: "B" },
  { min: 2200, rank: "A" },
  { min: 3800, rank: "S" },
];

export interface Score {
  points: number; // toplam XP
  level: number; // her 100 XP
  intoLevel: number; // mevcut seviyedeki XP (0-99)
  toNextLevel: number;
  progress: number; // 0-1
  rank: string; // E..S
  nextRank: string | null;
  toNextRank: number | null;
}

export function computeScore(entries: Entry[]): Score {
  let points = 0;
  for (const e of entries) {
    if (e.kind === "habit") points += e.done ? 10 : 2;
    else if (e.kind === "task") points += e.done ? 8 : 1;
    else if (e.kind === "journal") points += 6;
    else if (e.kind === "mood") points += 4;
  }
  const level = Math.floor(points / XP_PER_LEVEL) + 1;
  const intoLevel = points % XP_PER_LEVEL;

  let ri = 0;
  for (let i = 0; i < RANKS.length; i++) if (points >= RANKS[i].min) ri = i;
  const next = RANKS[ri + 1] ?? null;

  return {
    points,
    level,
    intoLevel,
    toNextLevel: XP_PER_LEVEL - intoLevel,
    progress: intoLevel / XP_PER_LEVEL,
    rank: RANKS[ri].rank,
    nextRank: next ? next.rank : null,
    toNextRank: next ? next.min - points : null,
  };
}

export interface HunterStats {
  str: number;
  int: number;
  vit: number;
  dex: number;
}

const RE_STR = /koş|yürü|spor|antren|gym|fitness|yoga|bisiklet|yüz|egzersiz|ağırlık|plank|şınav/i;
const RE_INT = /oku|kitap|ders|çalış|study|öğren|kurs|dil|kod|yazıl|proje/i;
const RE_VIT = /uyku|uyu|\bsu\b|medita|vitamin|diş|sağlık|yemek|nefes|namaz|şükür/i;

/** Alışkanlık türlerinden Avcı statları. */
export function computeStats(entries: Entry[]): HunterStats {
  let str = 0,
    int = 0,
    vit = 0,
    dex = 0;
  for (const e of entries) {
    if (e.kind === "habit" && e.done) {
      const n = e.name;
      if (RE_STR.test(n)) str += 1;
      else if (RE_INT.test(n)) int += 1;
      else if (RE_VIT.test(n)) vit += 1;
      else vit += 1; // tanımlanamayan rutin -> genel sağlık (VIT)
    } else if (e.kind === "task" && e.done) {
      dex += 1; // tamamlanan görevler -> disiplin/çeviklik
    }
  }
  return { str, int, vit, dex };
}
