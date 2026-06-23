import type { Entry, Goal, Routine } from "./types";
import { computeScore, computeStats } from "./score";
import { habitNames, habitStreak } from "./stats";

export interface Achievement {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  unlocked: boolean;
}

const RANK_ORDER = ["E", "D", "C", "B", "A", "S"];

/** Mevcut rank'e göre Avcı unvanı. */
export function titleFor(rank: string): string {
  switch (rank) {
    case "S":
      return "Gölge Hükümdarı";
    case "A":
      return "Elit Avcı";
    case "B":
      return "Kıdemli Avcı";
    case "C":
      return "Yetkin Avcı";
    case "D":
      return "Çırak Avcı";
    default:
      return "Acemi Avcı";
  }
}

export function computeAchievements(
  entries: Entry[],
  routines: Routine[],
  goals: Goal[]
): Achievement[] {
  const score = computeScore(entries);
  const st = computeStats(entries);
  const journals = entries.filter((e) => e.kind === "journal").length;
  const bestStreak = Math.max(0, ...habitNames(entries).map((h) => habitStreak(entries, h.name)));
  const rankIdx = RANK_ORDER.indexOf(score.rank);

  const A = (
    id: string,
    emoji: string,
    name: string,
    desc: string,
    unlocked: boolean
  ): Achievement => ({ id, emoji, name, desc, unlocked });

  return [
    A("first", "👣", "İlk Adım", "İlk kaydını oluştur", entries.length >= 1),
    A("warmup", "🔥", "Isınıyor", "Toplam 10 kayıt", entries.length >= 10),
    A("regular", "📅", "Düzenli", "Toplam 50 kayıt", entries.length >= 50),
    A("lvl5", "⭐", "Yükselen", "Seviye 5'e ulaş", score.level >= 5),
    A("rankD", "🥉", "Çırak", "D-Rank'e ulaş", rankIdx >= 1),
    A("rankC", "🥈", "Yetkin", "C-Rank'e ulaş", rankIdx >= 2),
    A("rankS", "👑", "Hükümdar", "S-Rank'e ulaş", rankIdx >= 5),
    A("streak7", "💪", "Alev", "Bir alışkanlıkta 7 gün seri", bestStreak >= 7),
    A("streak30", "🌋", "Sönmez", "30 gün seri", bestStreak >= 30),
    A("str20", "⚔️", "Savaşçı", "STR 20", st.str >= 20),
    A("int20", "📚", "Bilge", "INT 20", st.int >= 20),
    A("vit20", "🛡️", "Dayanıklı", "VIT 20", st.vit >= 20),
    A("dex20", "🎯", "Usta", "DEX 20 (20 görev)", st.dex >= 20),
    A("journal10", "📝", "İç Ses", "10 günlük yaz", journals >= 10),
    A("goal", "🎯", "Hedef Koyan", "İlk hedefini koy", goals.length >= 1),
    A("routine3", "🔁", "Rutinci", "3 rutin tanımla", routines.length >= 3),
  ];
}
