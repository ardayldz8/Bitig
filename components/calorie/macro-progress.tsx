"use client";

import { Settings2 } from "lucide-react";
import { goalProgress, macroProgressList, type Totals } from "@/lib/calorie/totals";
import { displayNumber } from "@/lib/nutrition/calculate-nutrition";
import type { NutritionTargets } from "@/types/calorie";

type MacroProgressProps = {
  totals: Totals;
  targets: NutritionTargets;
  onEditTargets: () => void;
};

const BAR_COLORS: Record<string, string> = {
  protein: "bg-brand",
  carbohydrates: "bg-amber-500",
  fat: "bg-rose-400",
};

export default function MacroProgress({
  totals,
  targets,
  onEditTargets,
}: MacroProgressProps) {
  const macros = macroProgressList(totals, targets);

  return (
    <section
      aria-label="Makro besin ilerlemesi"
      className="rounded-card border border-line bg-surface p-5 shadow-card"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Makrolar</h2>
        <button
          type="button"
          onClick={onEditTargets}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-sm text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand"
        >
          <Settings2 size={16} aria-hidden="true" />
          Hedefleri düzenle
        </button>
      </div>

      <ul className="space-y-4">
        {macros.map((macro) => {
          const progress = goalProgress(macro.value, macro.target);
          return (
            <li key={macro.key}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="text-sm text-ink">{macro.label}</span>
                <span className="text-sm tabular-nums">
                  <strong className={progress.isOver ? "text-danger" : "text-ink"}>
                    {displayNumber(macro.value)}
                  </strong>
                  <span className="text-ink-soft"> / {displayNumber(macro.target)} g</span>
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-brand-soft"
                role="progressbar"
                aria-label={macro.label}
                aria-valuenow={Math.round(progress.percent)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuetext={`${displayNumber(macro.value)} / ${displayNumber(macro.target)} gram`}
              >
                <div
                  className={`h-full rounded-full ${
                    progress.isOver ? "bg-danger" : BAR_COLORS[macro.key]
                  }`}
                  style={{ width: `${progress.ratio * 100}%` }}
                />
              </div>
              {progress.isOver && (
                <p className="mt-1 text-xs text-danger">
                  {displayNumber(progress.overBy)} g hedef aşıldı
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
