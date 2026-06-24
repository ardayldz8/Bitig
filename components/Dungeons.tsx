"use client";

import { useState } from "react";
import type { Dungeon, Entry, Goal } from "@/lib/types";
import { dayKey, uid } from "@/lib/store";
import { authHeaders } from "@/lib/api";

export default function Dungeons({
  dungeons,
  entries,
  goals,
  onCreate,
  onToggleStep,
  onDelete,
}: {
  dungeons: Dungeon[];
  entries: Entry[];
  goals: Goal[];
  onCreate: (d: Dungeon) => void;
  onToggleStep: (dungeonId: string, stepId: string) => void;
  onDelete: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function generate() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/dungeon", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ entries: entries.slice(0, 80), goals, today: dayKey() }),
      });
      const data = await res.json();
      const steps = Array.isArray(data.steps) ? data.steps : [];
      const d: Dungeon = {
        id: uid(),
        name: typeof data.name === "string" && data.name.trim() ? data.name.trim() : "İsimsiz Zindan",
        rank: typeof data.rank === "string" ? data.rank : "E",
        boss: typeof data.boss === "string" ? data.boss : undefined,
        steps: steps.map((t: unknown) => ({ id: uid(), text: String(t), done: false })),
        completedAt: null,
      };
      if (d.steps.length) onCreate(d);
    } catch {
      // yoksay
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6">
      <div className="rounded-2xl bg-slate-900 p-4 text-violet-50 shadow-[0_0_24px_-10px_rgba(167,139,250,0.5)] ring-1 ring-violet-400/40">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-violet-300/80">
            ⛩ Zindanlar
          </span>
          <button
            onClick={generate}
            disabled={busy}
            className="rounded-full bg-violet-400/15 px-3 py-1 text-[11px] font-semibold text-violet-200 ring-1 ring-violet-400/40 transition active:scale-95 disabled:opacity-40"
          >
            {busy ? "Açılıyor…" : "+ Yeni zindan"}
          </button>
        </div>

        {dungeons.length === 0 && !busy && (
          <p className="py-3 text-sm text-violet-200/60">
            Henüz zindan yok. “+ Yeni zindan” ile sana özel bir meydan okuma açılır; ya da sohbette
            “bana bir zindan oluştur” de.
          </p>
        )}

        <div className="space-y-3">
          {dungeons.map((d) => {
            const done = d.steps.filter((s) => s.done).length;
            const total = d.steps.length;
            const cleared = !!d.completedAt || (total > 0 && done === total);
            const pct = total > 0 ? (done / total) * 100 : 0;
            return (
              <div
                key={d.id}
                className={`rounded-xl p-3 ring-1 ${
                  cleared ? "bg-violet-400/10 ring-violet-300/50" : "bg-violet-400/5 ring-violet-400/20"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 rounded-md bg-violet-400/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-violet-200">
                        {d.rank}-Rank
                      </span>
                      <h4 className="truncate text-sm font-semibold text-violet-50">{d.name}</h4>
                    </div>
                    {d.boss && <p className="mt-1 text-[11px] italic text-violet-200/60">👑 {d.boss}</p>}
                  </div>
                  <button
                    onClick={() => onDelete(d.id)}
                    className="shrink-0 text-violet-300/50 transition hover:text-violet-200"
                    aria-label="Zindanı sil"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-violet-400/15">
                    <div className="h-full rounded-full bg-violet-400 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="shrink-0 text-[10px] tabular-nums text-violet-200/60">
                    {done}/{total}
                  </span>
                </div>

                <div className="mt-2 space-y-1">
                  {d.steps.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => onToggleStep(d.id, s.id)}
                      className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition active:scale-[0.99]"
                    >
                      <span
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded border-2 text-[10px] ${
                          s.done ? "border-violet-400 bg-violet-400 text-slate-900" : "border-violet-400/50"
                        }`}
                      >
                        {s.done ? "✓" : ""}
                      </span>
                      <span className={`text-sm ${s.done ? "text-violet-200/40 line-through" : "text-violet-100"}`}>
                        {s.text}
                      </span>
                    </button>
                  ))}
                </div>

                {cleared && (
                  <p className="mt-2 text-center text-xs font-semibold tracking-[0.2em] text-violet-200">
                    ⟪ ZİNDAN TEMİZLENDİ ⟫
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
