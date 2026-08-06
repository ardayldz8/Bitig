"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import Modal from "@/components/ui/modal";
import { fieldErrors, projectInputSchema, type ProjectInput } from "@/lib/projects/validation";
import { PROJECT_STATUS_LABELS, type Project, type ProjectStatus } from "@/types/project";

const STATUSES: ProjectStatus[] = ["active", "on_hold", "completed", "archived"];
const fieldClass = "min-h-11 w-full rounded-xl border bg-surface px-3.5 py-2.5 text-ink";

export default function ProjectFormModal({
  project,
  onSave,
  onClose,
}: {
  project: Project | null;
  onSave: (input: ProjectInput) => void;
  onClose: () => void;
}) {
  const baseId = useId();
  const [values, setValues] = useState({
    name: project?.name ?? "",
    description: project?.description ?? "",
    status: project?.status ?? ("active" as ProjectStatus),
    technologies: (project?.technologies ?? []).join(", "),
    githubFullName: project?.githubFullName ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = projectInputSchema.safeParse({
      name: values.name,
      description: values.description.trim() || null,
      status: values.status,
      technologies: values.technologies
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      githubFullName: values.githubFullName.trim() || null,
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
      title={project ? "Projeyi düzenle" : "Yeni proje"}
      titleId={id("title")}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field id={id("name")} label="Proje adı" error={errors.name}>
          <input
            id={id("name")}
            type="text"
            autoComplete="off"
            value={values.name}
            onChange={(event) => setValues((v) => ({ ...v, name: event.target.value }))}
            placeholder="Örn: Bitig"
            aria-invalid={errors.name ? true : undefined}
            className={`${fieldClass} ${errors.name ? "border-danger" : "border-line"}`}
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
            placeholder="Kısa açıklama"
            className={`${fieldClass} border-line`}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={id("status")} label="Durum">
            <select
              id={id("status")}
              value={values.status}
              onChange={(event) =>
                setValues((v) => ({ ...v, status: event.target.value as ProjectStatus }))
              }
              className={`${fieldClass} border-line`}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {PROJECT_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </Field>

          <Field
            id={id("repo")}
            label="GitHub repository (opsiyonel)"
            error={errors.githubFullName}
          >
            <input
              id={id("repo")}
              type="text"
              autoComplete="off"
              value={values.githubFullName}
              onChange={(event) =>
                setValues((v) => ({ ...v, githubFullName: event.target.value }))
              }
              placeholder="kullanici/repo"
              aria-invalid={errors.githubFullName ? true : undefined}
              className={`${fieldClass} ${errors.githubFullName ? "border-danger" : "border-line"}`}
            />
          </Field>
        </div>

        <Field id={id("tech")} label="Teknolojiler (virgülle ayır)">
          <input
            id={id("tech")}
            type="text"
            autoComplete="off"
            value={values.technologies}
            onChange={(event) =>
              setValues((v) => ({ ...v, technologies: event.target.value }))
            }
            placeholder="Next.js, TypeScript, Tailwind CSS"
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
