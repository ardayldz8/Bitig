import type { Entry, Goal, Routine } from "./types";
import { dayKey } from "./store";

type MoodEntry = Extract<Entry, { kind: "mood" }>;
type TaskEntry = Extract<Entry, { kind: "task" }>;

/** Bugünden geriye n günün gün anahtarları (eskiden yeniye). */
export function lastNDays(n: number): string[] {
  const out: string[] = [];
  const base = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    out.push(dayKey(d));
  }
  return out;
}

export interface DayMood {
  date: string;
  avg: number | null;
}

export function moodByDay(entries: Entry[], days: string[]): DayMood[] {
  return days.map((date) => {
    const ms = entries.filter(
      (e): e is MoodEntry => e.kind === "mood" && e.date === date
    );
    const avg = ms.length ? ms.reduce((s, m) => s + m.score, 0) / ms.length : null;
    return { date, avg };
  });
}

const norm = (s: string) => s.trim().toLocaleLowerCase("tr");

/**
 * HP — son 3 günde (bugün hariç) rutin kaçırınca düşer.
 * Yalnızca kullanıcının aktif olduğu (en az 1 kayıt) günleri sayar →
 * yeni kullanıcıyı / uygulamayı açmadığın günleri cezalandırmaz.
 */
export function computeHp(
  entries: Entry[],
  routines: Routine[]
): { hp: number; missed: number } {
  if (routines.length === 0) return { hp: 100, missed: 0 };
  const days = lastNDays(4).slice(0, 3); // son 3 gün (bugün hariç)
  let penalty = 0;
  let missed = 0;
  for (const d of days) {
    const active = entries.some((e) => e.date === d);
    if (!active) continue;
    const completed = routines.filter((r) =>
      entries.some(
        (e) => e.kind === "habit" && e.done && e.date === d && norm(e.name) === norm(r.name)
      )
    ).length;
    const m = routines.length - completed;
    missed += m;
    penalty += m * 8;
  }
  return { hp: Math.max(0, 100 - penalty), missed };
}

/** Bir hedefin mevcut dönemdeki ilerlemesi (count veya amount). */
export function goalProgress(entries: Entry[], goal: Goal): number {
  const dayset = goal.period === "day" ? new Set([dayKey()]) : new Set(lastNDays(7));
  const g = norm(goal.habit);
  let v = 0;
  for (const e of entries) {
    if (e.kind === "habit" && e.done && dayset.has(e.date)) {
      const n = norm(e.name);
      if (n.includes(g) || g.includes(n)) {
        v += goal.metric === "amount" ? e.amount ?? 0 : 1;
      }
    }
  }
  return v;
}

/** Bir alışkanlığın bugüne (ya da düne) kadar üst üste gün serisi. */
export function habitStreak(entries: Entry[], name: string): number {
  const target = norm(name);
  const days = new Set(
    entries
      .filter((e) => e.kind === "habit" && norm(e.name) === target && e.done)
      .map((e) => e.date)
  );
  let streak = 0;
  const d = new Date();
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1); // bugün boşsa dünden başla
  while (days.has(dayKey(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/** Sıklığa göre sıralı benzersiz alışkanlık adları. */
export function habitNames(entries: Entry[]): { name: string; count: number }[] {
  const m = new Map<string, { name: string; count: number }>();
  for (const e of entries) {
    if (e.kind === "habit") {
      const key = norm(e.name);
      const cur = m.get(key);
      if (cur) cur.count++;
      else m.set(key, { name: e.name.trim(), count: 1 });
    }
  }
  return [...m.values()].sort((a, b) => b.count - a.count);
}

export interface RangeStat {
  habits: number;
  tasksDone: number;
  tasksTotal: number;
  moodAvg: number | null;
  journals: number;
}

export function rangeStats(entries: Entry[], dayset: Set<string>): RangeStat {
  const inRange = entries.filter((e) => dayset.has(e.date));
  const tasks = inRange.filter((e): e is TaskEntry => e.kind === "task");
  const moods = inRange.filter((e): e is MoodEntry => e.kind === "mood");
  return {
    habits: inRange.filter((e) => e.kind === "habit").length,
    tasksDone: tasks.filter((t) => t.done).length,
    tasksTotal: tasks.length,
    moodAvg: moods.length ? moods.reduce((s, m) => s + m.score, 0) / moods.length : null,
    journals: inRange.filter((e) => e.kind === "journal").length,
  };
}

/** Otomatik (kural tabanlı) örüntü içgörüleri — AI gerektirmez, ücretsiz. */
export function patterns(entries: Entry[]): string[] {
  const out: string[] = [];
  const names = habitNames(entries);

  // En uzun aktif seri
  let best = { name: "", streak: 0 };
  for (const { name } of names) {
    const s = habitStreak(entries, name);
    if (s > best.streak) best = { name, streak: s };
  }
  if (best.streak >= 2) out.push(`🔥 En uzun aktif serin: ${best.name} — ${best.streak} gün üst üste.`);

  // En sık alışkanlık
  if (names.length && names[0].count >= 3) {
    out.push(`⭐ En sık alışkanlığın: ${names[0].name} (${names[0].count} kayıt).`);
  }

  // Ara verilen alışkanlık (önceden düzenli, son 3 gün yok)
  const today = new Date();
  const last3 = new Set(
    [0, 1, 2].map((i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      return dayKey(d);
    })
  );
  for (const { name } of names.slice(0, 6)) {
    const total = entries.filter((e) => e.kind === "habit" && norm(e.name) === norm(name)).length;
    const recent = entries.some(
      (e) => e.kind === "habit" && norm(e.name) === norm(name) && last3.has(e.date)
    );
    if (total >= 3 && !recent) {
      out.push(`⏸️ ${name} alışkanlığına 3+ gündür ara verdin.`);
      break;
    }
  }

  // Ruh hali ile aktivite ilişkisi
  const moodDays = new Map<string, number[]>();
  for (const e of entries) {
    if (e.kind === "mood") {
      const a = moodDays.get(e.date) ?? [];
      a.push(e.score);
      moodDays.set(e.date, a);
    }
  }
  const habitDays = new Set(
    entries.filter((e) => e.kind === "habit" && e.done).map((e) => e.date)
  );
  let withSum = 0,
    withN = 0,
    woSum = 0,
    woN = 0;
  for (const [date, scores] of moodDays) {
    const avg = scores.reduce((s, x) => s + x, 0) / scores.length;
    if (habitDays.has(date)) {
      withSum += avg;
      withN++;
    } else {
      woSum += avg;
      woN++;
    }
  }
  if (withN >= 2 && woN >= 2) {
    const w = withSum / withN;
    const o = woSum / woN;
    if (w - o >= 0.4) {
      out.push(`🙂 Alışkanlık yaptığın günler ruh halin daha iyi (${w.toFixed(1)} vs ${o.toFixed(1)}/5).`);
    }
  }

  return out;
}
