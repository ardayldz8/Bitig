"use client";

import { useId, useState, type FormEvent } from "react";
import Modal from "@/components/ui/modal";
import { fieldErrors, noteInputSchema, type NoteInput } from "@/lib/projects/validation";
import type { ProjectFeature, ProjectNote } from "@/types/project";

const fieldClass = "min-h-11 w-full rounded-xl border bg-surface px-3.5 py-2.5 text-ink";

export default function NoteFormModal({
  note,
  features,
  onSave,
  onClose,
}: {
  note: ProjectNote | null;
  features: ProjectFeature[];
  onSave: (input: NoteInput) => void;
  onClose: () => void;
}) {
  const baseId = useId();
  const [values, setValues] = useState({
    title: note?.title ?? "",
    content: note?.content ?? "",
    relatedFeatureId: note?.relatedFeatureId ?? "",
    tags: (note?.tags ?? []).join(", "),
    pinned: note?.pinned ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = noteInputSchema.safeParse({
      title: values.title,
      content: values.content,
      relatedFeatureId: values.relatedFeatureId || null,
      tags: values.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      pinned: values.pinned,
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
      title={note ? "Notu düzenle" : "Yeni not"}
      titleId={id("title-label")}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor={id("title")} className="mb-1.5 block text-sm font-medium text-ink">
            Başlık
          </label>
          <input
            id={id("title")}
            type="text"
            autoComplete="off"
            value={values.title}
            onChange={(event) => setValues((v) => ({ ...v, title: event.target.value }))}
            aria-invalid={errors.title ? true : undefined}
            className={`${fieldClass} ${errors.title ? "border-danger" : "border-line"}`}
          />
          {errors.title && (
            <p role="alert" className="mt-1.5 text-sm text-danger">
              {errors.title}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={id("content")} className="mb-1.5 block text-sm font-medium text-ink">
            İçerik (Markdown)
          </label>
          <textarea
            id={id("content")}
            rows={8}
            value={values.content}
            onChange={(event) => setValues((v) => ({ ...v, content: event.target.value }))}
            placeholder="# Başlık&#10;- Madde&#10;**kalın** ve `kod`"
            className={`${fieldClass} border-line font-mono text-xs`}
          />
          <p className="mt-1.5 text-xs text-ink-soft">
            Başlık, liste, kalın, italik, kod ve bağlantı desteklenir. HTML etiketleri
            güvenlik için metin olarak gösterilir.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={id("feature")} className="mb-1.5 block text-sm font-medium text-ink">
              Bağlı özellik
            </label>
            <select
              id={id("feature")}
              value={values.relatedFeatureId}
              onChange={(event) =>
                setValues((v) => ({ ...v, relatedFeatureId: event.target.value }))
              }
              className={`${fieldClass} border-line`}
            >
              <option value="">Bağlı değil</option>
              {features.map((feature) => (
                <option key={feature.id} value={feature.id}>
                  {feature.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={id("tags")} className="mb-1.5 block text-sm font-medium text-ink">
              Etiketler (virgülle ayır)
            </label>
            <input
              id={id("tags")}
              type="text"
              autoComplete="off"
              value={values.tags}
              onChange={(event) => setValues((v) => ({ ...v, tags: event.target.value }))}
              placeholder="plan, altyapı"
              className={`${fieldClass} border-line`}
            />
          </div>
        </div>

        <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={values.pinned}
            onChange={(event) => setValues((v) => ({ ...v, pinned: event.target.checked }))}
            className="h-4 w-4 accent-[var(--color-brand)]"
          />
          Notu sabitle
        </label>

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
