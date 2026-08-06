"use client";

import { useId, useState } from "react";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import { displayInteger, displayNumber } from "@/lib/nutrition/calculate-nutrition";
import { MEAL_LABELS, UNIT_LABELS, type FoodEntry, type MealType } from "@/types/calorie";
import { SOURCE_LABELS } from "@/types/nutrition";

type MealSectionProps = {
  mealType: MealType;
  entries: FoodEntry[];
  onEdit: (entry: FoodEntry) => void;
  onDelete: (entry: FoodEntry) => void;
};

const MEAL_ICON: Record<MealType, string> = {
  breakfast: "🌅",
  lunch: "☀️",
  dinner: "🌙",
  snack: "🍎",
};

const MEAL_TINT: Record<MealType, string> = {
  breakfast: "bg-amber-100 text-amber-700",
  lunch: "bg-orange-100 text-orange-700",
  dinner: "bg-brand-soft text-brand-strong",
  snack: "bg-emerald-100 text-emerald-700",
};

export default function MealSection({
  mealType,
  entries,
  onEdit,
  onDelete,
}: MealSectionProps) {
  const panelId = useId();
  const [open, setOpen] = useState(false);

  const totalCalories = entries.reduce((sum, entry) => sum + entry.calories, 0);

  return (
    <div className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        disabled={entries.length === 0}
        className="flex min-h-11 w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-brand-soft/40 disabled:cursor-default disabled:hover:bg-transparent"
      >
        <span
          aria-hidden="true"
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg ${MEAL_TINT[mealType]}`}
        >
          {MEAL_ICON[mealType]}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block font-medium text-ink">{MEAL_LABELS[mealType]}</span>
          <span className="block text-sm text-ink-soft">
            {entries.length} öğe
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span className="font-semibold tabular-nums text-ink">
            {displayInteger(totalCalories)}
          </span>
          <span className="text-sm text-ink-soft"> kcal</span>
        </span>

        {entries.length > 0 && (
          <ChevronDown
            size={18}
            aria-hidden="true"
            className={`shrink-0 text-ink-soft transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {open && entries.length > 0 && (
        <ul id={panelId} className="space-y-2 px-4 pb-4">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-start gap-3 rounded-xl border border-line bg-canvas p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{entry.name}</p>
                {entry.brand && <p className="text-xs text-ink-soft">{entry.brand}</p>}
                <p className="mt-0.5 text-sm text-ink-soft">
                  {displayNumber(entry.quantity)} {UNIT_LABELS[entry.unit]} ·{" "}
                  <strong className="font-medium text-ink">
                    {displayNumber(entry.calories)} kcal
                  </strong>
                </p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  Kaynak: {SOURCE_LABELS[entry.source]}
                  {entry.manuallyEdited && entry.source !== "manual" ? " (düzenlendi)" : ""}
                </p>
              </div>

              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={() => onEdit(entry)}
                  aria-label={`${entry.name} kaydını düzenle`}
                  className="grid h-11 w-11 place-items-center rounded-lg border border-line text-ink-soft transition-colors hover:border-brand hover:text-brand"
                >
                  <Pencil size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(entry)}
                  aria-label={`${entry.name} kaydını sil`}
                  className="grid h-11 w-11 place-items-center rounded-lg border border-line text-ink-soft transition-colors hover:border-danger hover:text-danger"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
