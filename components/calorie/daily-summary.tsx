"use client";

import { displayInteger } from "@/lib/nutrition/calculate-nutrition";
import { goalProgress } from "@/lib/calorie/totals";

type DailySummaryProps = {
  consumed: number;
  target: number;
};

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function DailySummary({ consumed, target }: DailySummaryProps) {
  const progress = goalProgress(consumed, target);
  const percentLabel = Math.round(progress.percent);

  return (
    <section
      aria-label="Günlük kalori özeti"
      className="rounded-card border border-line bg-surface p-5 shadow-card"
    >
      <div className="flex flex-col items-center gap-5 sm:flex-row">
        <div className="relative grid shrink-0 place-items-center">
          <svg
            width="128"
            height="128"
            viewBox="0 0 120 120"
            className="-rotate-90"
            role="img"
            aria-label={`${displayInteger(consumed)} / ${displayInteger(target)} kilokalori, yüzde ${percentLabel} tamamlandı`}
          >
            <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="var(--color-brand-soft)" strokeWidth="11" />
            <circle
              cx="60"
              cy="60"
              r={RADIUS}
              fill="none"
              stroke={progress.isOver ? "var(--color-danger)" : "var(--color-brand)"}
              strokeWidth="11"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              // ratio 0-1 arasına sıkıştırılır → gösterge asla taşmaz
              strokeDashoffset={CIRCUMFERENCE * (1 - progress.ratio)}
            />
          </svg>
          <div className="absolute text-center">
            <p className="text-2xl font-bold leading-none tabular-nums">
              {displayInteger(consumed)}
            </p>
            <p className="mt-1 text-xs text-ink-soft">/ {displayInteger(target)}</p>
            <p className="text-xs text-ink-soft">kcal</p>
          </div>
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-sm text-ink-soft">Günlük hedef</p>
          <p className="text-3xl font-bold tabular-nums">
            {displayInteger(target)} <span className="text-base font-medium text-ink-soft">kcal</span>
          </p>

          <p className="mt-3 inline-block rounded-full bg-brand-soft px-3 py-1.5 text-sm font-medium text-brand-strong">
            %{percentLabel} tamamlandı
          </p>

          <p
            className={`mt-2 text-sm font-medium ${progress.isOver ? "text-danger" : "text-ink-soft"}`}
          >
            {progress.isOver
              ? `${displayInteger(progress.overBy)} kcal hedef aşıldı`
              : `${displayInteger(progress.remaining)} kcal kaldı`}
          </p>
        </div>
      </div>
    </section>
  );
}
