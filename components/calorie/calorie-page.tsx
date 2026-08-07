"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { BarChart3, Plus } from "lucide-react";
import AnalysisResult from "@/components/calorie/analysis-result";
import DailySummary from "@/components/calorie/daily-summary";
import FoodEntryModal, { type EntryPrefill } from "@/components/calorie/food-entry-modal";
import DescribeFood from "@/components/calorie/describe-food";
import RecipePanel from "@/components/calorie/recipe-panel";
import FoodScanner from "@/components/calorie/food-scanner";
import MacroProgress from "@/components/calorie/macro-progress";
import MealSection from "@/components/calorie/meal-section";
import NutritionTargetsModal from "@/components/calorie/nutrition-targets-modal";
import Modal from "@/components/ui/modal";
import { useCalorieTracker, createId } from "@/hooks/use-calorie-tracker";
import { useActionParam } from "@/hooks/use-action-param";
import { useFoodAnalysis } from "@/hooks/use-food-analysis";
import { checkImageBeforeUpload, prepareImage } from "@/lib/calorie/image";
import { entriesByMeal, goalProgress, sumTotals } from "@/lib/calorie/totals";
import { displayInteger } from "@/lib/nutrition/calculate-nutrition";
import {
  MEAL_TYPES,
  type FoodEntry,
  type MealType,
} from "@/types/calorie";

type DialogState =
  | { type: "none" }
  | { type: "entry"; entry: FoodEntry | null; prefill?: EntryPrefill }
  | { type: "targets" }
  | { type: "delete"; entry: FoodEntry };

export default function CaloriePage() {
  const tracker = useCalorieTracker();
  const analysis = useFoodAnalysis();
  const dateInputId = useId();
  const confirmId = useId();

  const [dialog, setDialog] = useState<DialogState>({ type: "none" });
  const [labelBusy, setLabelBusy] = useState(false);
  const [labelError, setLabelError] = useState<string | null>(null);
  const lastFileRef = useRef<{ file: File; mode: "meal" | "label" } | null>(null);
  const scannerRef = useRef<HTMLDivElement>(null);

  // Ana sayfadaki "Yemek tara" hızlı işlemi: tarama alanını görünür yap ve odakla
  const scanAction = useActionParam("scan");
  useEffect(() => {
    if (!scanAction.triggered || !tracker.hydrated) return;
    const node = scannerRef.current;
    if (!node) return;

    node.scrollIntoView({ behavior: "smooth", block: "center" });
    node.querySelector<HTMLButtonElement>("button")?.focus();
    scanAction.clear();
  }, [scanAction, tracker.hydrated]);

  const totals = sumTotals(tracker.dayEntries);
  const calorieProgress = goalProgress(totals.calories, tracker.targets.calories);

  /** Besin etiketi OCR'ı: değerler otomatik kaydedilmez, forma önizleme olarak düşer. */
  const analyzeLabel = useCallback(async (file: File) => {
    const localError = checkImageBeforeUpload(file);
    if (localError) {
      setLabelError(localError);
      return;
    }

    setLabelBusy(true);
    setLabelError(null);
    try {
      const prepared = await prepareImage(file);
      const form = new FormData();
      form.append("image", prepared.file);

      const response = await fetch("/api/food/nutrition-label", {
        method: "POST",
        body: form,
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          typeof payload === "object" && payload !== null
            ? (payload as { error?: unknown }).error
            : null;
        setLabelError(
          typeof message === "string" ? message : "Etiket okunamadı.",
        );
        return;
      }

      const result =
        typeof payload === "object" && payload !== null
          ? (payload as { result?: unknown }).result
          : null;
      if (typeof result !== "object" || result === null) {
        setLabelError("Etiket okunamadı.");
        return;
      }

      const label = result as Record<string, unknown>;
      const numberOrUndefined = (value: unknown): number | undefined =>
        typeof value === "number" && Number.isFinite(value) ? value : undefined;

      setDialog({
        type: "entry",
        entry: null,
        prefill: {
          name: typeof label.productName === "string" ? label.productName : "",
          brand: typeof label.brand === "string" ? label.brand : null,
          quantity:
            label.valuesArePer100 === true
              ? 100
              : (numberOrUndefined(label.servingSize) ?? 100),
          unit: "g",
          calories: numberOrUndefined(label.calories),
          protein: numberOrUndefined(label.protein),
          carbohydrates: numberOrUndefined(label.carbohydrates),
          fat: numberOrUndefined(label.fat),
          source: "nutrition_label",
        },
      });
    } catch {
      setLabelError("Etiket okunamadı. Değerleri manuel girebilirsin.");
    } finally {
      setLabelBusy(false);
    }
  }, []);

  const handleImageSelected = useCallback(
    (file: File, mode: "meal" | "label") => {
      lastFileRef.current = { file, mode };
      if (mode === "label") {
        void analyzeLabel(file);
      } else {
        void analysis.analyzeImage(file);
      }
    },
    [analysis, analyzeLabel],
  );

  const handleRetry = useCallback(() => {
    const last = lastFileRef.current;
    analysis.reset();
    if (!last) return;
    if (last.mode === "label") void analyzeLabel(last.file);
    else void analysis.analyzeImage(last.file);
  }, [analysis, analyzeLabel]);

  /** Analiz sonucu ancak kullanıcı onayladığında günlüğe yazılır. */
  const handleSaveAnalysis = useCallback(
    (mealType: MealType) => {
      const rows = analysis.outcome?.rows ?? [];
      if (rows.length === 0) return;

      const now = new Date().toISOString();
      const consumedAt = buildConsumedAt(tracker.selectedDate);

      const entries: FoodEntry[] = rows.map((row) => ({
        id: createId(),
        name: row.name,
        brand: row.brand,
        quantity: row.quantity,
        unit: row.unit,
        calories: row.calories,
        protein: row.protein,
        carbohydrates: row.carbohydrates,
        fat: row.fat,
        mealType,
        source: row.manuallyEdited ? "manual" : (row.match?.source ?? "manual"),
        sourceFoodId: row.match?.foodId ?? null,
        // Kullanıcı düzenlediyse bile sağlayıcının hesapladığı değer korunur
        originalCalories: row.originalCalories,
        originalProtein: row.originalProtein,
        originalCarbohydrates: row.originalCarbohydrates,
        originalFat: row.originalFat,
        manuallyEdited: row.manuallyEdited,
        confidence: row.confidence,
        consumedAt,
        createdAt: now,
        updatedAt: now,
      }));

      tracker.addEntries(entries);
      analysis.reset();
    },
    [analysis, tracker],
  );

  const handleEntrySave = useCallback(
    (entry: FoodEntry) => {
      if (dialog.type === "entry" && dialog.entry) {
        tracker.updateEntry(entry.id, entry);
      } else {
        tracker.addEntries([entry]);
      }
      setDialog({ type: "none" });
    },
    [dialog, tracker],
  );

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[1100px] px-4 pt-8 pb-12 sm:px-6 sm:pt-10">
      <header>
        {/* Marka alanı üstteki gezinme çubuğunda */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Kalori Takibi
            </h1>
            <p className="mt-1.5 text-ink-soft">
              Yediklerini takip et, hedeflerine ulaş.
            </p>
          </div>

          <div className="sm:pt-1">
            <label
              htmlFor={dateInputId}
              className="mb-1.5 block text-sm font-medium text-ink-soft"
            >
              Tarih
            </label>
            <input
              id={dateInputId}
              type="date"
              value={tracker.selectedDate}
              onChange={(event) => tracker.setSelectedDate(event.target.value)}
              disabled={!tracker.hydrated}
              className="min-h-11 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-ink disabled:opacity-50"
            />
          </div>
        </div>
      </header>

      {!tracker.hydrated ? (
        // Veriler yalnızca mount sonrası okunur → hydration uyuşmazlığı olmaz
        <div aria-busy="true" aria-live="polite" className="mt-7 space-y-4">
          <p className="sr-only">Kayıtlar yükleniyor</p>
          <div className="h-48 rounded-card border border-line bg-surface" />
          <div className="h-40 rounded-card border border-line bg-surface" />
        </div>
      ) : (
        <>
          <div className="mt-7 grid gap-4 lg:grid-cols-2">
            <DailySummary
              consumed={totals.calories}
              target={tracker.targets.calories}
            />
            <MacroProgress
              totals={totals}
              targets={tracker.targets}
              onEditTargets={() => setDialog({ type: "targets" })}
            />
          </div>

          <div ref={scannerRef} className="mt-4">
            <FoodScanner
              stage={analysis.stage}
              error={analysis.error ?? labelError}
              isBusy={analysis.isBusy || labelBusy}
              onImageSelected={handleImageSelected}
              onBarcodeDetected={(barcode) => void analysis.analyzeBarcode(barcode)}
              onManualAdd={() => setDialog({ type: "entry", entry: null })}
              onRetry={handleRetry}
            />
          </div>

          {/* Sonuç incelenirken metin alanı gizlenir: iki farklı giriş
              aynı anda açık kalırsa hangisinin sonucuna bakıldığı belirsizleşir. */}
          {analysis.stage !== "done" && (
            <div className="mt-4">
              <DescribeFood
                onSubmit={(text) => void analysis.analyzeDescription(text)}
                disabled={analysis.isBusy || labelBusy}
              />
            </div>
          )}

          {analysis.stage === "done" && analysis.outcome && (
            <div className="mt-4">
              <AnalysisResult
                outcome={analysis.outcome}
                onChangeRow={analysis.updateRow}
                onRemoveRow={analysis.removeRow}
                onSave={handleSaveAnalysis}
                onCancel={analysis.reset}
              />
            </div>
          )}

          {/*
            Tarifler analiz akışının dışında: fotoğraf/metin bir kereliktir,
            tarif ise kayıtlı ve tekrar kullanılan bir tanım.
          */}
          {analysis.stage !== "done" && (
            <div className="mt-4">
              <RecipePanel onAdd={(entry) => tracker.addEntries([entry])} />
            </div>
          )}

          <section className="mt-6">
            <h2 className="mb-3 text-base font-semibold text-ink">Öğünler</h2>
            <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
              {MEAL_TYPES.map((meal) => (
                <MealSection
                  key={meal}
                  mealType={meal}
                  entries={entriesByMeal(tracker.dayEntries, meal)}
                  onEdit={(entry) => setDialog({ type: "entry", entry })}
                  onDelete={(entry) => setDialog({ type: "delete", entry })}
                />
              ))}
            </div>
          </section>

          <section className="mt-4 rounded-card border border-line bg-brand-soft/60 p-5">
            <div className="flex items-center gap-4">
              <span
                aria-hidden="true"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface text-brand"
              >
                <BarChart3 size={20} />
              </span>
              <div className="flex flex-1 flex-wrap gap-x-8 gap-y-3">
                <div>
                  <p className="text-sm text-ink-soft">Günlük toplam</p>
                  <p className="text-xl font-bold tabular-nums text-ink">
                    {displayInteger(totals.calories)}{" "}
                    <span className="text-sm font-medium text-ink-soft">kcal</span>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-ink-soft">
                    {calorieProgress.isOver ? "Aşım" : "Kalan"}
                  </p>
                  <p
                    className={`text-xl font-bold tabular-nums ${
                      calorieProgress.isOver ? "text-danger" : "text-ink"
                    }`}
                  >
                    {displayInteger(
                      calorieProgress.isOver
                        ? calorieProgress.overBy
                        : calorieProgress.remaining,
                    )}{" "}
                    <span className="text-sm font-medium text-ink-soft">kcal</span>
                  </p>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      <button
        type="button"
        onClick={() => setDialog({ type: "entry", entry: null })}
        // Dar ekranda alt sekme çubuğunun (3.5rem) üstünde durur
        className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-5 py-3.5 font-medium text-white shadow-card transition-colors hover:bg-brand-strong sm:right-6 sm:bottom-6"
      >
        <Plus size={18} aria-hidden="true" />
        Yiyecek ekle
      </button>

      {dialog.type === "entry" && (
        <FoodEntryModal
          entry={dialog.entry}
          prefill={dialog.prefill}
          defaultDate={tracker.selectedDate}
          onSave={handleEntrySave}
          onClose={() => setDialog({ type: "none" })}
        />
      )}

      {dialog.type === "targets" && (
        <NutritionTargetsModal
          targets={tracker.targets}
          onSave={(next) => {
            tracker.saveTargets(next);
            setDialog({ type: "none" });
          }}
          onClose={() => setDialog({ type: "none" })}
        />
      )}

      {dialog.type === "delete" && (
        <Modal
          title="Kaydı sil"
          titleId={confirmId}
          onClose={() => setDialog({ type: "none" })}
        >
          <p className="text-ink-soft">
            <span className="font-medium text-ink">{dialog.entry.name}</span> kaydı
            silinecek. Bu işlem geri alınamaz.
          </p>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setDialog({ type: "none" })}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line px-4 py-2.5 font-medium text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={() => {
                tracker.removeEntry(dialog.entry.id);
                setDialog({ type: "none" });
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-danger px-5 py-2.5 font-medium text-white transition-colors hover:brightness-95"
            >
              Sil
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Seçili gün + şu anki saat → ISO. Geçmiş bir gün seçiliyse öğlen kullanılır. */
function buildConsumedAt(selectedDate: string): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  if (!selectedDate || selectedDate === todayKey) return now.toISOString();

  const parsed = new Date(`${selectedDate}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? now.toISOString() : parsed.toISOString();
}
