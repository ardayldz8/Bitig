"use client";

import { useId, useState, type FormEvent } from "react";
import Modal from "@/components/ui/modal";
import {
  parseDecimal,
  validateManualForm,
  type ManualFormErrors,
  type ManualFormValues,
} from "@/lib/calorie/validation";
import { createId } from "@/hooks/use-calorie-tracker";
import {
  MEAL_LABELS,
  MEAL_TYPES,
  UNIT_LABELS,
  type FoodEntry,
  type MealType,
} from "@/types/calorie";
import type { FoodUnit, NutritionSource } from "@/types/nutrition";

export type EntryPrefill = {
  name?: string;
  brand?: string | null;
  quantity?: number;
  unit?: FoodUnit;
  calories?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  source?: NutritionSource;
};

type FoodEntryModalProps = {
  /** Doluysa düzenleme, boşsa yeni kayıt. */
  entry: FoodEntry | null;
  prefill?: EntryPrefill;
  defaultDate: string;
  onSave: (entry: FoodEntry) => void;
  onClose: () => void;
};

const UNITS: FoodUnit[] = ["g", "ml", "piece", "portion"];
const fieldClass = "w-full rounded-xl border bg-surface px-3.5 py-2.5 text-ink";

/** ISO → datetime-local ("YYYY-MM-DDTHH:mm"), yerel saatte. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

function initialValues(
  entry: FoodEntry | null,
  prefill: EntryPrefill | undefined,
  defaultDate: string,
): ManualFormValues {
  if (entry) {
    return {
      name: entry.name,
      brand: entry.brand ?? "",
      quantity: String(entry.quantity),
      unit: entry.unit,
      calories: String(entry.calories),
      protein: String(entry.protein),
      carbohydrates: String(entry.carbohydrates),
      fat: String(entry.fat),
      mealType: entry.mealType,
      consumedAt: toLocalInput(entry.consumedAt),
    };
  }

  const now = new Date();
  // Seçili gün bugünden farklıysa o günün öğlen saati kullanılır
  const base = defaultDate ? new Date(`${defaultDate}T12:00:00`) : now;
  const useNow = defaultDate === toLocalInput(now.toISOString()).slice(0, 10);

  return {
    name: prefill?.name ?? "",
    brand: prefill?.brand ?? "",
    quantity: prefill?.quantity !== undefined ? String(prefill.quantity) : "100",
    unit: prefill?.unit ?? "g",
    calories: prefill?.calories !== undefined ? String(prefill.calories) : "",
    protein: prefill?.protein !== undefined ? String(prefill.protein) : "",
    carbohydrates:
      prefill?.carbohydrates !== undefined ? String(prefill.carbohydrates) : "",
    fat: prefill?.fat !== undefined ? String(prefill.fat) : "",
    mealType: "snack",
    consumedAt: toLocalInput((useNow ? now : base).toISOString()),
  };
}

export default function FoodEntryModal({
  entry,
  prefill,
  defaultDate,
  onSave,
  onClose,
}: FoodEntryModalProps) {
  const baseId = useId();
  const isEditing = entry !== null;

  const [values, setValues] = useState<ManualFormValues>(() =>
    initialValues(entry, prefill, defaultDate),
  );
  const [errors, setErrors] = useState<ManualFormErrors>({});

  function setField(key: keyof ManualFormValues, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateManualForm(values);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const quantity = parseDecimal(values.quantity) ?? 0;
    const calories = parseDecimal(values.calories) ?? 0;
    const protein = parseDecimal(values.protein) ?? 0;
    const carbohydrates = parseDecimal(values.carbohydrates) ?? 0;
    const fat = parseDecimal(values.fat) ?? 0;
    const now = new Date().toISOString();
    const consumedAt = new Date(values.consumedAt).toISOString();

    if (entry) {
      // Değerlerden biri değiştiyse manuel düzenleme olarak işaretle
      const changed =
        calories !== entry.calories ||
        protein !== entry.protein ||
        carbohydrates !== entry.carbohydrates ||
        fat !== entry.fat ||
        quantity !== entry.quantity ||
        values.unit !== entry.unit;

      onSave({
        ...entry,
        name: values.name.trim(),
        brand: values.brand.trim() || null,
        quantity,
        unit: values.unit as FoodUnit,
        calories,
        protein,
        carbohydrates,
        fat,
        mealType: values.mealType as MealType,
        manuallyEdited: entry.manuallyEdited || changed,
        consumedAt,
        updatedAt: now,
      });
      return;
    }

    const source: NutritionSource = prefill?.source ?? "manual";
    onSave({
      id: createId(),
      name: values.name.trim(),
      brand: values.brand.trim() || null,
      quantity,
      unit: values.unit as FoodUnit,
      calories,
      protein,
      carbohydrates,
      fat,
      mealType: values.mealType as MealType,
      source,
      sourceFoodId: null,
      originalCalories: prefill?.calories ?? null,
      originalProtein: prefill?.protein ?? null,
      originalCarbohydrates: prefill?.carbohydrates ?? null,
      originalFat: prefill?.fat ?? null,
      manuallyEdited: source === "manual",
      confidence: null,
      consumedAt,
      createdAt: now,
      updatedAt: now,
    });
  }

  return (
    <Modal
      title={isEditing ? "Kaydı düzenle" : "Yiyecek ekle"}
      titleId={`${baseId}-title`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field id={`${baseId}-name`} label="Yiyecek adı" error={errors.name}>
          <input
            id={`${baseId}-name`}
            type="text"
            autoComplete="off"
            value={values.name}
            onChange={(event) => setField("name", event.target.value)}
            placeholder="Örn: Izgara tavuk göğsü"
            aria-invalid={errors.name ? true : undefined}
            className={`${fieldClass} ${errors.name ? "border-danger" : "border-line"}`}
          />
        </Field>

        <Field id={`${baseId}-brand`} label="Marka (opsiyonel)">
          <input
            id={`${baseId}-brand`}
            type="text"
            autoComplete="off"
            value={values.brand}
            onChange={(event) => setField("brand", event.target.value)}
            placeholder="Örn: Pınar"
            className={`${fieldClass} border-line`}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${baseId}-quantity`} label="Miktar" error={errors.quantity}>
            <input
              id={`${baseId}-quantity`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={values.quantity}
              onChange={(event) => setField("quantity", event.target.value)}
              aria-invalid={errors.quantity ? true : undefined}
              className={`${fieldClass} ${errors.quantity ? "border-danger" : "border-line"}`}
            />
          </Field>

          <Field id={`${baseId}-unit`} label="Birim">
            <select
              id={`${baseId}-unit`}
              value={values.unit}
              onChange={(event) => setField("unit", event.target.value)}
              className={`${fieldClass} border-line`}
            >
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {UNIT_LABELS[unit]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${baseId}-calories`} label="Kalori (kcal)" error={errors.calories}>
            <input
              id={`${baseId}-calories`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={values.calories}
              onChange={(event) => setField("calories", event.target.value)}
              aria-invalid={errors.calories ? true : undefined}
              className={`${fieldClass} ${errors.calories ? "border-danger" : "border-line"}`}
            />
          </Field>

          <Field id={`${baseId}-protein`} label="Protein (g)" error={errors.protein}>
            <input
              id={`${baseId}-protein`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={values.protein}
              onChange={(event) => setField("protein", event.target.value)}
              aria-invalid={errors.protein ? true : undefined}
              className={`${fieldClass} ${errors.protein ? "border-danger" : "border-line"}`}
            />
          </Field>

          <Field
            id={`${baseId}-carbohydrates`}
            label="Karbonhidrat (g)"
            error={errors.carbohydrates}
          >
            <input
              id={`${baseId}-carbohydrates`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={values.carbohydrates}
              onChange={(event) => setField("carbohydrates", event.target.value)}
              aria-invalid={errors.carbohydrates ? true : undefined}
              className={`${fieldClass} ${errors.carbohydrates ? "border-danger" : "border-line"}`}
            />
          </Field>

          <Field id={`${baseId}-fat`} label="Yağ (g)" error={errors.fat}>
            <input
              id={`${baseId}-fat`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={values.fat}
              onChange={(event) => setField("fat", event.target.value)}
              aria-invalid={errors.fat ? true : undefined}
              className={`${fieldClass} ${errors.fat ? "border-danger" : "border-line"}`}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${baseId}-meal`} label="Öğün">
            <select
              id={`${baseId}-meal`}
              value={values.mealType}
              onChange={(event) => setField("mealType", event.target.value)}
              className={`${fieldClass} border-line`}
            >
              {MEAL_TYPES.map((meal) => (
                <option key={meal} value={meal}>
                  {MEAL_LABELS[meal]}
                </option>
              ))}
            </select>
          </Field>

          <Field id={`${baseId}-consumed`} label="Tarih ve saat" error={errors.consumedAt}>
            <input
              id={`${baseId}-consumed`}
              type="datetime-local"
              value={values.consumedAt}
              onChange={(event) => setField("consumedAt", event.target.value)}
              aria-invalid={errors.consumedAt ? true : undefined}
              className={`${fieldClass} ${errors.consumedAt ? "border-danger" : "border-line"}`}
            />
          </Field>
        </div>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line px-4 py-2.5 font-medium text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand"
          >
            Vazgeç
          </button>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 py-2.5 font-medium text-white transition-colors hover:bg-brand-strong"
          >
            {isEditing ? "Değişiklikleri kaydet" : "Öğüne kaydet"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
