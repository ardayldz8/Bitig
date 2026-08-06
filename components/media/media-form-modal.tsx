"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import Modal from "@/components/ui/modal";
import {
  emptyFormValues,
  formValuesFromEntry,
  validateMediaForm,
} from "@/lib/media/validation";
import type { MediaDraft } from "@/hooks/use-media-library";
import {
  MEDIA_TYPE_LABELS,
  STATUS_LABELS,
  type MediaEntry,
  type MediaFormErrors,
  type MediaFormValues,
  type MediaType,
  type WatchStatus,
} from "@/types/media";

type MediaFormModalProps = {
  /** null ise yeni kayıt, doluysa düzenleme. */
  entry: MediaEntry | null;
  entries: MediaEntry[];
  onSave: (draft: MediaDraft) => void;
  onClose: () => void;
};

const MEDIA_TYPES: MediaType[] = ["series", "movie"];
const STATUSES: WatchStatus[] = ["watching", "completed", "planned"];
const fieldClass = "min-h-11 w-full rounded-xl border bg-surface px-3.5 py-2.5 text-ink";

export default function MediaFormModal({
  entry,
  entries,
  onSave,
  onClose,
}: MediaFormModalProps) {
  const baseId = useId();
  const isEditing = entry !== null;

  const [values, setValues] = useState<MediaFormValues>(() =>
    entry ? formValuesFromEntry(entry) : emptyFormValues(),
  );
  const [errors, setErrors] = useState<MediaFormErrors>({});

  const isSeries = values.mediaType === "series";

  function setField<K extends keyof MediaFormValues>(key: K, value: MediaFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateMediaForm(values, entries, entry?.id ?? null);

    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    onSave(result.data);
  }

  const id = (name: string) => `${baseId}-${name}`;

  return (
    <Modal
      title={isEditing ? "Yapımı düzenle" : "Yeni yapım ekle"}
      titleId={id("title-label")}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field id={id("title")} label="Yapım adı" error={errors.title}>
          <input
            id={id("title")}
            type="text"
            autoComplete="off"
            value={values.title}
            onChange={(event) => setField("title", event.target.value)}
            placeholder="Örn: Dark"
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? `${id("title")}-error` : undefined}
            className={`${fieldClass} ${errors.title ? "border-danger" : "border-line"}`}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={id("type")} label="Yapım türü">
            <select
              id={id("type")}
              value={values.mediaType}
              onChange={(event) => setField("mediaType", event.target.value as MediaType)}
              className={`${fieldClass} border-line`}
            >
              {MEDIA_TYPES.map((type) => (
                <option key={type} value={type}>
                  {MEDIA_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </Field>

          <Field id={id("year")} label="Çıkış yılı" error={errors.releaseYear}>
            <input
              id={id("year")}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={values.releaseYear}
              onChange={(event) => setField("releaseYear", event.target.value)}
              placeholder="Örn: 2017"
              aria-invalid={errors.releaseYear ? true : undefined}
              className={`${fieldClass} ${errors.releaseYear ? "border-danger" : "border-line"}`}
            />
          </Field>

          <Field id={id("status")} label="İzleme durumu">
            <select
              id={id("status")}
              value={values.status}
              onChange={(event) => setField("status", event.target.value as WatchStatus)}
              className={`${fieldClass} border-line`}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </Field>

          <Field id={id("rating")} label="Puan (opsiyonel, 10 üzerinden)" error={errors.rating}>
            <input
              id={id("rating")}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={values.rating}
              onChange={(event) => setField("rating", event.target.value)}
              placeholder="Örn: 8,5"
              aria-invalid={errors.rating ? true : undefined}
              className={`${fieldClass} ${errors.rating ? "border-danger" : "border-line"}`}
            />
          </Field>
        </div>

        <Field id={id("poster")} label="Poster adresi (opsiyonel)" error={errors.posterUrl}>
          <input
            id={id("poster")}
            type="url"
            autoComplete="off"
            value={values.posterUrl}
            onChange={(event) => setField("posterUrl", event.target.value)}
            placeholder="https://..."
            aria-invalid={errors.posterUrl ? true : undefined}
            className={`${fieldClass} ${errors.posterUrl ? "border-danger" : "border-line"}`}
          />
        </Field>

        {/* Dizi alanları — film seçilince gizlenir ve kayıtta null olur */}
        {isSeries && (
          <fieldset className="rounded-xl border border-line p-4">
            <legend className="px-1.5 text-sm font-medium text-ink">Dizi bilgileri</legend>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={id("season")} label="Mevcut sezon" error={errors.currentSeason}>
                <input
                  id={id("season")}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={values.currentSeason}
                  onChange={(event) => setField("currentSeason", event.target.value)}
                  aria-invalid={errors.currentSeason ? true : undefined}
                  className={`${fieldClass} ${errors.currentSeason ? "border-danger" : "border-line"}`}
                />
              </Field>

              <Field id={id("episode")} label="Mevcut bölüm" error={errors.currentEpisode}>
                <input
                  id={id("episode")}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={values.currentEpisode}
                  onChange={(event) => setField("currentEpisode", event.target.value)}
                  aria-invalid={errors.currentEpisode ? true : undefined}
                  className={`${fieldClass} ${errors.currentEpisode ? "border-danger" : "border-line"}`}
                />
              </Field>

              <Field
                id={id("total-seasons")}
                label="Toplam sezon (opsiyonel)"
                error={errors.totalSeasons}
              >
                <input
                  id={id("total-seasons")}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={values.totalSeasons}
                  onChange={(event) => setField("totalSeasons", event.target.value)}
                  aria-invalid={errors.totalSeasons ? true : undefined}
                  className={`${fieldClass} ${errors.totalSeasons ? "border-danger" : "border-line"}`}
                />
              </Field>

              <Field
                id={id("total-episodes")}
                label="Toplam bölüm (opsiyonel)"
                error={errors.totalEpisodes}
              >
                <input
                  id={id("total-episodes")}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={values.totalEpisodes}
                  onChange={(event) => setField("totalEpisodes", event.target.value)}
                  aria-invalid={errors.totalEpisodes ? true : undefined}
                  className={`${fieldClass} ${errors.totalEpisodes ? "border-danger" : "border-line"}`}
                />
              </Field>
            </div>

            <div className="mt-4">
              <Field
                id={id("watched")}
                label="İzlenen toplam bölüm (opsiyonel)"
                error={errors.watchedEpisodes}
              >
                <input
                  id={id("watched")}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={values.watchedEpisodes}
                  onChange={(event) => setField("watchedEpisodes", event.target.value)}
                  aria-invalid={errors.watchedEpisodes ? true : undefined}
                  className={`${fieldClass} ${errors.watchedEpisodes ? "border-danger" : "border-line"}`}
                />
              </Field>
              <p className="mt-1.5 text-xs text-ink-soft">
                Sezon başına bölüm sayısı bilinmediği için yüzdelik ilerleme yalnızca bu
                alanı doldurduğunda (ya da yapım tamamlandığında) gösterilir.
              </p>
            </div>
          </fieldset>
        )}

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
            {isEditing ? "Değişiklikleri kaydet" : "Kaydet"}
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
