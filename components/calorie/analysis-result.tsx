"use client";

import { useId, useState } from "react";
import { TriangleAlert } from "lucide-react";
import DetectedFoodRow from "@/components/calorie/detected-food-row";
import { displayNumber } from "@/lib/nutrition/calculate-nutrition";
import { MEAL_LABELS, MEAL_TYPES, type DetectedFood, type MealType } from "@/types/calorie";
import type { AnalysisOutcome } from "@/hooks/use-food-analysis";

type AnalysisResultProps = {
  outcome: AnalysisOutcome;
  onChangeRow: (rowId: string, patch: Partial<DetectedFood>) => void;
  onRemoveRow: (rowId: string) => void;
  onSave: (mealType: MealType) => void;
  onCancel: () => void;
};

export default function AnalysisResult({
  outcome,
  onChangeRow,
  onRemoveRow,
  onSave,
  onCancel,
}: AnalysisResultProps) {
  const mealId = useId();
  const [mealType, setMealType] = useState<MealType>(guessMeal());

  const total = outcome.rows.reduce((sum, row) => sum + row.calories, 0);
  const canSave = outcome.rows.length > 0;

  if (outcome.noFoodFound) {
    return (
      <section
        aria-live="polite"
        className="rounded-card border border-line bg-surface p-5 shadow-card"
      >
        <h2 className="text-lg font-semibold text-ink">Yiyecek bulunamadı</h2>
        <p className="mt-1.5 text-sm text-ink-soft">
          Bu fotoğrafta tanıyabildiğim bir yiyecek yok. Daha net bir fotoğraf deneyebilir
          ya da yiyeceği manuel ekleyebilirsin.
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-line px-4 py-2.5 font-medium text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand"
        >
          Kapat
        </button>
      </section>
    );
  }

  return (
    <section
      aria-live="polite"
      aria-label="Analiz sonucu"
      className="rounded-card border border-line bg-surface p-5 shadow-card"
    >
      <h2 className="text-lg font-semibold text-ink">Bulunan yiyecekler</h2>

      {/* Kaydetmeden önce kontrol uyarısı — her zaman görünür */}
      <p className="mt-3 flex items-start gap-2 rounded-xl bg-brand-soft px-3.5 py-3 text-sm text-brand-strong">
        <TriangleAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
        Bu değerler AI ve porsiyon tahminine dayanır. Kaydetmeden önce miktarları kontrol
        et.
      </p>

      {outcome.lowConfidence && (
        <p className="mt-2 text-sm text-ink-soft">
          Fotoğraf net okunamadı — tahminler daha az güvenilir olabilir.
        </p>
      )}

      {/* Metinden çıkarılamayan noktalar. Model miktar uydurmadığı için
          bunları kullanıcının doldurması gerekiyor. */}
      {outcome.unclear && outcome.unclear.length > 0 && (
        <div className="mt-2 rounded-xl bg-amber-100 px-3.5 py-2.5 text-sm text-amber-800">
          <p className="font-medium">Şunları netleştirmen gerekiyor:</p>
          <ul className="mt-1 list-inside list-disc">
            {outcome.unclear.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Geçici erişim sorunu, kalıcı "bulunamadı"dan ayrı gösterilir:
          biri birkaç dakikada geçer, diğeri manuel giriş gerektirir. */}
      {outcome.sourceUnavailable && (
        <p
          role="status"
          className="mt-2 rounded-xl bg-amber-100 px-3.5 py-2.5 text-sm text-amber-800"
        >
          {outcome.sourceUnavailable}
        </p>
      )}

      <ul className="mt-4 space-y-3">
        {outcome.rows.map((row) => (
          <DetectedFoodRow
            key={row.rowId}
            row={row}
            onChange={onChangeRow}
            onRemove={onRemoveRow}
          />
        ))}
      </ul>

      <p className="mt-4 text-right text-sm text-ink-soft">
        Tahmini toplam:{" "}
        <strong className="text-base font-semibold text-ink">
          {displayNumber(total)} kcal
        </strong>
      </p>

      <div className="mt-5 border-t border-line pt-4">
        <label htmlFor={mealId} className="mb-1.5 block text-sm font-medium text-ink">
          Hangi öğüne kaydedilsin?
        </label>
        <select
          id={mealId}
          value={mealType}
          onChange={(event) => setMealType(event.target.value as MealType)}
          className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-ink sm:max-w-xs"
        >
          {MEAL_TYPES.map((meal) => (
            <option key={meal} value={meal}>
              {MEAL_LABELS[meal]}
            </option>
          ))}
        </select>

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line px-4 py-2.5 font-medium text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={() => onSave(mealType)}
            disabled={!canSave}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 py-2.5 font-medium text-white transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
          >
            Öğüne kaydet
          </button>
        </div>
      </div>
    </section>
  );
}

/** Saate göre makul bir öğün önerisi. */
function guessMeal(): MealType {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  if (hour < 22) return "dinner";
  return "snack";
}
