"use client";

import type { Entry, Goal } from "@/lib/types";
import { goalProgress } from "@/lib/stats";

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export default function Goals({
  goals,
  entries,
  onDelete,
}: {
  goals: Goal[];
  entries: Entry[];
  onDelete: (id: string) => void;
}) {
  if (!goals.length) return null;
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
        <span>🎯</span>
        Hedefler
      </h2>
      <div className="space-y-2">
        {goals.map((g) => {
          const cur = goalProgress(entries, g);
          const pct = g.target > 0 ? Math.min(1, cur / g.target) : 0;
          const done = cur >= g.target && g.target > 0;
          return (
            <div
              key={g.id}
              className="group rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span className="flex-1 font-medium">{g.title}</span>
                <span
                  className={`text-sm ${done ? "font-semibold text-green-500" : "text-[var(--muted)]"}`}
                >
                  {fmt(cur)}/{fmt(g.target)} {g.unit ?? ""} {done ? "✓" : ""}
                </span>
                <button
                  onClick={() => onDelete(g.id)}
                  className="shrink-0 text-[var(--muted)] opacity-60 transition hover:opacity-100"
                  aria-label="Sil"
                >
                  ✕
                </button>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--border)]">
                <div
                  className={`h-full rounded-full transition-all ${done ? "bg-green-500" : "bg-indigo-500"}`}
                  style={{ width: `${Math.round(pct * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {g.period === "day" ? "bugün" : "bu hafta"}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
