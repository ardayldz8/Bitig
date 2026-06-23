"use client";

import type { Entry } from "@/lib/types";
import {
  lastNDays,
  moodByDay,
  rangeStats,
  habitNames,
  habitStreak,
  patterns,
  computeHp,
} from "@/lib/stats";
import { computeScore, computeStats } from "@/lib/score";
import { titleFor, computeAchievements } from "@/lib/achievements";
import type { Goal, Routine } from "@/lib/types";
import Quests from "@/components/Quests";
import Goals from "@/components/Goals";

const FACES = ["", "😞", "😕", "😐", "🙂", "😄"];

export default function Stats({
  entries,
  goals,
  routines,
  userId,
  onChanged,
  onDeleteGoal,
}: {
  entries: Entry[];
  goals: Goal[];
  routines: Routine[];
  userId: string;
  onChanged: () => Promise<void> | void;
  onDeleteGoal: (id: string) => void;
}) {
  const sc = computeScore(entries);
  const st = computeStats(entries);
  const hp = computeHp(entries, routines);
  const title = titleFor(sc.rank);
  const achievements = computeAchievements(entries, routines, goals);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  const days14 = lastNDays(14);
  const mood = moodByDay(entries, days14);
  const moodVals = mood.map((m) => m.avg).filter((v): v is number => v != null);
  const moodAvg = moodVals.length ? moodVals.reduce((s, x) => s + x, 0) / moodVals.length : null;

  const thisWeek = rangeStats(entries, new Set(lastNDays(7)));
  const lastWeek = rangeStats(entries, new Set(lastNDays(14).slice(0, 7)));

  const streaks = habitNames(entries)
    .slice(0, 6)
    .map((h) => ({ ...h, streak: habitStreak(entries, h.name) }))
    .sort((a, b) => b.streak - a.streak);

  const pats = patterns(entries);

  return (
    <div className="space-y-6 pt-2">
      {/* System durum penceresi */}
      <section>
        <div className="rounded-2xl bg-slate-900 p-5 text-cyan-50 shadow-[0_0_30px_-8px_rgba(34,211,238,0.55)] ring-1 ring-cyan-400/40">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-400/80">
              ⟦ Status ⟧
            </span>
            <span className="text-[11px] tracking-wider text-cyan-300/60">Bitig SYSTEM</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-cyan-400/10 ring-1 ring-cyan-400/50">
              <span className="text-2xl font-black text-cyan-300">{sc.rank}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold">
                Seviye {sc.level}{" "}
                <span className="text-sm font-medium text-cyan-300/70">· {sc.rank}-Rank</span>
              </p>
              <p className="text-xs italic text-cyan-300/80">« {title} »</p>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-cyan-950 ring-1 ring-cyan-400/20">
                <div
                  className="h-full rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] transition-all"
                  style={{ width: `${Math.round(sc.progress * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-cyan-300/60">
                XP {sc.intoLevel}/100
                {sc.toNextRank != null ? ` · ${sc.nextRank}-Rank'a ${sc.toNextRank} XP` : " · MAX RANK 🎉"}
              </p>
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-rose-300/90">HP</span>
              <span className="text-rose-300/70">
                {hp.hp}/100{hp.hp < 50 ? " ⚠" : ""}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-rose-950 ring-1 ring-rose-400/20">
              <div
                className="h-full rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.7)] transition-all"
                style={{ width: `${hp.hp}%` }}
              />
            </div>
            {hp.hp < 50 && (
              <p className="mt-1 text-xs text-rose-400">
                ⚠ Düşük HP — System cezası: bugün rutinlerini tamamla.
              </p>
            )}
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2">
            <StatBox label="STR" v={st.str} />
            <StatBox label="INT" v={st.int} />
            <StatBox label="VIT" v={st.vit} />
            <StatBox label="DEX" v={st.dex} />
          </div>
        </div>
      </section>

      {/* Günün questleri */}
      <Quests userId={userId} entries={entries} onChanged={onChanged} />

      {/* Hedefler */}
      <Goals goals={goals} entries={entries} onDelete={onDeleteGoal} />

      {/* Başarımlar */}
      <section>
        <H>
          Başarımlar · {unlockedCount}/{achievements.length}
        </H>
        <div className="grid grid-cols-4 gap-2">
          {achievements.map((a) => (
            <div
              key={a.id}
              title={`${a.name} — ${a.desc}`}
              className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-center ${
                a.unlocked
                  ? "border-[var(--border)] bg-[var(--card)]"
                  : "border-transparent bg-[var(--card)] opacity-40"
              }`}
            >
              <span className="text-2xl">{a.unlocked ? a.emoji : "🔒"}</span>
              <span className="text-[10px] leading-tight text-[var(--muted)]">{a.name}</span>
            </div>
          ))}
        </div>
      </section>

      {entries.length === 0 ? (
        <p className="px-1 py-4 text-center text-sm text-[var(--muted)]">
          İlk questini tamamla ya da Sohbet&apos;ten kayıt ekle — grafikler ve örüntüler burada belirsin.
        </p>
      ) : (
        <>
          {/* Örüntüler */}
          {pats.length > 0 && (
            <section>
              <H>İçgörüler</H>
              <div className="space-y-2">
                {pats.map((p, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3.5 text-sm leading-relaxed shadow-sm"
                  >
                    {p}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Bu hafta */}
          <section>
            <H>Bu hafta</H>
            <div className="grid grid-cols-2 gap-2">
              <Tile label="Alışkanlık" value={`${thisWeek.habits}`} delta={thisWeek.habits - lastWeek.habits} />
              <Tile
                label="Görev"
                value={`${thisWeek.tasksDone}/${thisWeek.tasksTotal}`}
                delta={thisWeek.tasksDone - lastWeek.tasksDone}
              />
              <Tile
                label="Ruh hali"
                value={thisWeek.moodAvg != null ? `${thisWeek.moodAvg.toFixed(1)}/5` : "—"}
                delta={
                  thisWeek.moodAvg != null && lastWeek.moodAvg != null
                    ? Number((thisWeek.moodAvg - lastWeek.moodAvg).toFixed(1))
                    : undefined
                }
              />
              <Tile label="Günlük" value={`${thisWeek.journals}`} delta={thisWeek.journals - lastWeek.journals} />
            </div>
          </section>

          {/* Ruh hali trendi */}
          {moodVals.length > 0 && (
            <section>
              <H>
                Ruh hali · son 14 gün{" "}
                {moodAvg != null && (
                  <span className="font-normal normal-case text-[var(--muted)]">
                    (ort {moodAvg.toFixed(1)}/5 {FACES[Math.round(moodAvg)] ?? ""})
                  </span>
                )}
              </H>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
                <div className="flex h-28 items-end gap-[3px]">
                  {mood.map((m, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t bg-indigo-500"
                      style={{
                        height: m.avg != null ? `${Math.max(10, (m.avg / 5) * 100)}%` : "4px",
                        opacity: m.avg != null ? 0.45 + (m.avg / 5) * 0.55 : 0.18,
                      }}
                      title={`${m.date}${m.avg != null ? `: ${m.avg.toFixed(1)}/5` : ""}`}
                    />
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-xs text-[var(--muted)]">
                  <span>14 gün önce</span>
                  <span>bugün</span>
                </div>
              </div>
            </section>
          )}

          {/* Seriler */}
          {streaks.length > 0 && (
            <section>
              <H>Alışkanlık serileri</H>
              <div className="space-y-2">
                {streaks.map((s) => (
                  <div
                    key={s.name}
                    className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm"
                  >
                    <span className="flex-1 font-medium capitalize">{s.name}</span>
                    <span className="text-sm text-[var(--muted)]">{s.count} kayıt</span>
                    <span
                      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold ${
                        s.streak > 0
                          ? "bg-orange-500/15 text-orange-500"
                          : "bg-[var(--background)] text-[var(--muted)] ring-1 ring-[var(--border)]"
                      }`}
                    >
                      🔥 {s.streak}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function StatBox({ label, v }: { label: string; v: number }) {
  return (
    <div className="rounded-lg bg-cyan-400/5 p-2 text-center ring-1 ring-cyan-400/20">
      <p className="text-[10px] font-semibold tracking-wider text-cyan-400/70">{label}</p>
      <p className="text-lg font-bold text-cyan-100">{v}</p>
    </div>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
      {children}
    </h2>
  );
}

function Tile({ label, value, delta }: { label: string; value: string; delta?: number }) {
  const showDelta = delta != null && delta !== 0;
  const up = (delta ?? 0) > 0;
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold">{value}</span>
        {showDelta && (
          <span className={`text-xs font-medium ${up ? "text-green-500" : "text-red-500"}`}>
            {up ? "▲" : "▼"} {Math.abs(delta as number)}
          </span>
        )}
      </div>
    </div>
  );
}
