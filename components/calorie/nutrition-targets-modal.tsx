"use client";

import { useId, useState, type FormEvent } from "react";
import Modal from "@/components/ui/modal";
import { parseDecimal } from "@/lib/calorie/validation";
import type { NutritionTargets } from "@/types/calorie";

type TargetsModalProps = {
  targets: NutritionTargets;
  onSave: (targets: NutritionTargets) => void;
  onClose: () => void;
};

type FieldKey = keyof NutritionTargets;

const FIELDS: { key: FieldKey; label: string; suffix: string }[] = [
  { key: "calories", label: "Günlük kalori", suffix: "kcal" },
  { key: "protein", label: "Protein", suffix: "g" },
  { key: "carbohydrates", label: "Karbonhidrat", suffix: "g" },
  { key: "fat", label: "Yağ", suffix: "g" },
];

export default function NutritionTargetsModal({
  targets,
  onSave,
  onClose,
}: TargetsModalProps) {
  const baseId = useId();
  const [values, setValues] = useState<Record<FieldKey, string>>({
    calories: String(targets.calories),
    protein: String(targets.protein),
    carbohydrates: String(targets.carbohydrates),
    fat: String(targets.fat),
  });
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: Partial<Record<FieldKey, string>> = {};
    const parsed: Partial<NutritionTargets> = {};

    for (const field of FIELDS) {
      const value = parseDecimal(values[field.key]);
      if (value === null) {
        nextErrors[field.key] = "Geçerli bir sayı gir.";
      } else if (value <= 0) {
        nextErrors[field.key] = "Sıfırdan büyük olmalı.";
      } else {
        parsed[field.key] = value;
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    onSave(parsed as NutritionTargets);
  }

  return (
    <Modal title="Hedefleri düzenle" titleId={`${baseId}-title`} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {FIELDS.map((field) => {
          const fieldId = `${baseId}-${field.key}`;
          const error = errors[field.key];
          return (
            <div key={field.key}>
              <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium text-ink">
                {field.label} ({field.suffix})
              </label>
              <input
                id={fieldId}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={values[field.key]}
                onChange={(event) => {
                  setValues((prev) => ({ ...prev, [field.key]: event.target.value }));
                  setErrors((prev) => ({ ...prev, [field.key]: undefined }));
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${fieldId}-error` : undefined}
                className={`w-full rounded-xl border bg-surface px-3.5 py-2.5 text-ink ${
                  error ? "border-danger" : "border-line"
                }`}
              />
              {error && (
                <p id={`${fieldId}-error`} role="alert" className="mt-1.5 text-sm text-danger">
                  {error}
                </p>
              )}
            </div>
          );
        })}

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
            Kaydet
          </button>
        </div>
      </form>
    </Modal>
  );
}
