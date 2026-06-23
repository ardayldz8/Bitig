"use client";

import type { Entry } from "@/lib/types";
import { nutritionForDay, type CalorieTargets } from "@/lib/nutrition";

export default function CalorieRing({
  entries,
  targets,
}: {
  entries: Entry[];
  targets: CalorieTargets;
}) {
  const n = nutritionForDay(entries);
  const remaining = targets.target - n.kcal;
  const pct = targets.target > 0 ? Math.min(1, n.kcal / targets.target) : 0;
  const over = n.kcal > targets.target;
  const R = 52;
  const C = 2 * Math.PI * R;

  return (
    <section className="mt-2">
      <div className="flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
        <div className="relative grid shrink-0 place-items-center">
          <svg width="116" height="116" viewBox="0 0 120 120" className="-rotate-90">
            <circle cx="60" cy="60" r={R} fill="none" stroke="var(--border)" strokeWidth="10" />
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke={over ? "#f43f5e" : "#6366f1"}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - pct)}
            />
          </svg>
          <div className="absolute text-center">
            <p className="text-2xl font-bold leading-none">{n.kcal}</p>
            <p className="mt-0.5 text-[10px] text-[var(--muted)]">/ {targets.target} kcal</p>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${over ? "text-rose-500" : ""}`}>
            {over ? `${Math.abs(remaining)} kcal fazla` : `${remaining} kcal kaldı`}
          </p>
          <div className="mt-2 space-y-1.5">
            <Macro label="Protein" v={n.protein} t={targets.protein} color="bg-emerald-500" />
            <Macro label="Karbonhidrat" v={n.carb} t={targets.carb} color="bg-amber-500" />
            <Macro label="Yağ" v={n.fat} t={targets.fat} color="bg-rose-500" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Macro({ label, v, t, color }: { label: string; v: number; t: number; color: string }) {
  const pct = t > 0 ? Math.min(1, v / t) : 0;
  return (
    <div>
      <div className="flex justify-between text-[11px] text-[var(--muted)]">
        <span>{label}</span>
        <span className="tabular-nums">
          {v}/{t} g
        </span>
      </div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}
