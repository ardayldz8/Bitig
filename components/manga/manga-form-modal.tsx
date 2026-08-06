"use client";

import { useId, useState, type FormEvent } from "react";
import Modal from "@/components/ui/modal";
import {
  MAX_RATING,
  emptyFormValues,
  formValuesFromManga,
  validateMangaForm,
} from "@/lib/manga";
import type {
  Manga,
  MangaDraft,
  MangaFormErrors,
  MangaFormValues,
  MangaStatus,
} from "@/types/manga";

type MangaFormModalProps = {
  /** null ise yeni kayıt, doluysa düzenleme modu. */
  manga: Manga | null;
  existingMangas: Manga[];
  onSubmit: (draft: MangaDraft) => void;
  onClose: () => void;
};

const fieldClass =
  "w-full rounded-xl border bg-surface px-3.5 py-2.5 text-ink placeholder:text-ink-soft/70";

export default function MangaFormModal({
  manga,
  existingMangas,
  onSubmit,
  onClose,
}: MangaFormModalProps) {
  const baseId = useId();
  const isEditing = manga !== null;

  const [values, setValues] = useState<MangaFormValues>(() =>
    manga ? formValuesFromManga(manga) : emptyFormValues(),
  );
  const [errors, setErrors] = useState<MangaFormErrors>({});

  function setField<K extends keyof MangaFormValues>(
    key: K,
    value: MangaFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateMangaForm(values, existingMangas, manga?.id ?? null);

    if (!result.ok) {
      setErrors(result.errors);
      return;
    }

    onSubmit(result.draft);
  }

  const nameId = `${baseId}-name`;
  const chapterId = `${baseId}-chapter`;
  const ratingId = `${baseId}-rating`;
  const statusId = `${baseId}-status`;
  const coverId = `${baseId}-cover`;

  return (
    <Modal
      title={isEditing ? "Mangayı düzenle" : "Yeni manga ekle"}
      titleId={`${baseId}-title`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field label="Manga adı" htmlFor={nameId} error={errors.name}>
          <input
            id={nameId}
            type="text"
            value={values.name}
            onChange={(event) => setField("name", event.target.value)}
            placeholder="Örn: Chainsaw Man"
            autoComplete="off"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? `${nameId}-error` : undefined}
            className={`${fieldClass} ${errors.name ? "border-danger" : "border-line"}`}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Kaldığım bölüm"
            htmlFor={chapterId}
            error={errors.currentChapter}
          >
            {/* type="text" + inputMode: mobilde sayı klavyesi açılır ama
                "12,5" gibi virgüllü ondalıklar tarayıcı tarafından silinmez. */}
            <input
              id={chapterId}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={values.currentChapter}
              onChange={(event) => setField("currentChapter", event.target.value)}
              placeholder="Örn: 123"
              aria-invalid={errors.currentChapter ? true : undefined}
              aria-describedby={
                errors.currentChapter ? `${chapterId}-error` : undefined
              }
              className={`${fieldClass} ${
                errors.currentChapter ? "border-danger" : "border-line"
              }`}
            />
          </Field>

          <Field
            label={`Puan (${MAX_RATING} üzerinden)`}
            htmlFor={ratingId}
            error={errors.rating}
          >
            <input
              id={ratingId}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={values.rating}
              onChange={(event) => setField("rating", event.target.value)}
              placeholder="Örn: 8,5"
              aria-invalid={errors.rating ? true : undefined}
              aria-describedby={errors.rating ? `${ratingId}-error` : undefined}
              className={`${fieldClass} ${
                errors.rating ? "border-danger" : "border-line"
              }`}
            />
          </Field>
        </div>

        <Field label="Durum" htmlFor={statusId}>
          <select
            id={statusId}
            value={values.status}
            onChange={(event) =>
              setField("status", event.target.value as MangaStatus)
            }
            className={`${fieldClass} border-line`}
          >
            <option value="reading">Devam ediyor</option>
            <option value="completed">Tamamlandı</option>
          </select>
        </Field>

        <Field label="Kapak adresi (opsiyonel)" htmlFor={coverId} error={errors.coverUrl}>
          <input
            id={coverId}
            type="url"
            value={values.coverUrl}
            onChange={(event) => setField("coverUrl", event.target.value)}
            placeholder="https://..."
            autoComplete="off"
            aria-invalid={errors.coverUrl ? true : undefined}
            aria-describedby={errors.coverUrl ? `${coverId}-error` : undefined}
            className={`${fieldClass} ${errors.coverUrl ? "border-danger" : "border-line"}`}
          />
        </Field>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-line px-4 py-2.5 font-medium text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand"
          >
            Vazgeç
          </button>
          <button
            type="submit"
            className="rounded-xl bg-brand px-5 py-2.5 font-medium text-white transition-colors hover:bg-brand-strong"
          >
            {isEditing ? "Değişiklikleri kaydet" : "Kaydet"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
