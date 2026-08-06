"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import Modal from "@/components/ui/modal";
import { featureInputSchema, fieldErrors, type FeatureInput } from "@/lib/projects/validation";
import {
  FEATURE_STATUS_LABELS,
  PRIORITY_LABELS,
  type FeaturePriority,
  type FeatureStatus,
  type ProjectFeature,
} from "@/types/project";

const STATUSES: FeatureStatus[] = [
  "planned",
  "in_progress",
  "completed",
  "blocked",
  "on_hold",
];
const PRIORITIES: FeaturePriority[] = ["low", "medium", "high", "critical"];
const fieldClass = "min-h-11 w-full rounded-xl border bg-surface px-3.5 py-2.5 text-ink";

export default function FeatureFormModal({
  feature,
  initial,
  onSave,
  onClose,
}: {
  feature: ProjectFeature | null;
  initial?: Partial<FeatureInput>;
  onSave: (input: FeatureInput) => void;
  onClose: () => void;
}) {
  const baseId = useId();
  const [values, setValues] = useState({
    title: feature?.title ?? initial?.title ?? "",
    description: feature?.description ?? initial?.description ?? "",
    status: feature?.status ?? ("planned" as FeatureStatus),
    priority: feature?.priority ?? initial?.priority ?? ("medium" as FeaturePriority),
    acceptanceCriteria: (feature?.acceptanceCriteria ?? initial?.acceptanceCriteria ?? []).join(
      "\n",
    ),
    targetDate: feature?.targetDate ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = featureInputSchema.safeParse({
      title: values.title,
      description: values.description.trim() || null,
      status: values.status,
      priority: values.priority,
      acceptanceCriteria: values.acceptanceCriteria
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      targetDate: values.targetDate.trim() || null,
    });

    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    onSave(parsed.data);
  }

  const id = (name: string) => `${baseId}-${name}`;

  return (
    <Modal
      title={feature ? "Özelliği düzenle" : "Yeni özellik"}
      titleId={id("title-label")}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field id={id("title")} label="Başlık" error={errors.title}>
          <input
            id={id("title")}
            type="text"
            autoComplete="off"
            value={values.title}
            onChange={(event) => setValues((v) => ({ ...v, title: event.target.value }))}
            aria-invalid={errors.title ? true : undefined}
            className={`${fieldClass} ${errors.title ? "border-danger" : "border-line"}`}
          />
        </Field>

        <Field id={id("description")} label="Açıklama">
          <textarea
            id={id("description")}
            rows={3}
            value={values.description}
            onChange={(event) =>
              setValues((v) => ({ ...v, description: event.target.value }))
            }
            className={`${fieldClass} border-line`}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field id={id("status")} label="Durum">
            <select
              id={id("status")}
              value={values.status}
              onChange={(event) =>
                setValues((v) => ({ ...v, status: event.target.value as FeatureStatus }))
              }
              className={`${fieldClass} border-line`}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {FEATURE_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </Field>

          <Field id={id("priority")} label="Öncelik">
            <select
              id={id("priority")}
              value={values.priority}
              onChange={(event) =>
                setValues((v) => ({ ...v, priority: event.target.value as FeaturePriority }))
              }
              className={`${fieldClass} border-line`}
            >
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_LABELS[priority]}
                </option>
              ))}
            </select>
          </Field>

          <Field id={id("target")} label="Hedef tarih" error={errors.targetDate}>
            <input
              id={id("target")}
              type="date"
              value={values.targetDate}
              onChange={(event) =>
                setValues((v) => ({ ...v, targetDate: event.target.value }))
              }
              className={`${fieldClass} ${errors.targetDate ? "border-danger" : "border-line"}`}
            />
          </Field>
        </div>

        <Field id={id("criteria")} label="Kabul kriterleri (her satıra bir madde)">
          <textarea
            id={id("criteria")}
            rows={4}
            value={values.acceptanceCriteria}
            onChange={(event) =>
              setValues((v) => ({ ...v, acceptanceCriteria: event.target.value }))
            }
            className={`${fieldClass} border-line`}
          />
        </Field>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line px-4 font-medium text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand"
          >
            Vazgeç
          </button>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 font-medium text-white transition-colors hover:bg-brand-strong"
          >
            Kaydet
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
  children: ReactNode;
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
