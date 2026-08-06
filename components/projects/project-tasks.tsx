"use client";

import { useId, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PRIORITY_LABELS, type FeaturePriority, type ProjectFeature, type ProjectTask } from "@/types/project";

type TasksProps = {
  tasks: ProjectTask[];
  features: ProjectFeature[];
  onCreate: (title: string, priority: FeaturePriority, relatedFeatureId: string | null) => void;
  onToggle: (task: ProjectTask) => void;
  onDelete: (task: ProjectTask) => void;
};

const PRIORITIES: FeaturePriority[] = ["low", "medium", "high", "critical"];

export default function ProjectTasks({
  tasks,
  features,
  onCreate,
  onToggle,
  onDelete,
}: TasksProps) {
  const baseId = useId();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<FeaturePriority>("medium");
  const [featureId, setFeatureId] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "done">("all");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = title.trim();
    if (!value) {
      setError("Görev başlığı boş bırakılamaz.");
      return;
    }
    onCreate(value, priority, featureId || null);
    setTitle("");
    setError(null);
  }

  const visible = tasks.filter((task) =>
    filter === "all" ? true : filter === "open" ? !task.completed : task.completed,
  );

  return (
    <section>
      <form onSubmit={handleSubmit} className="rounded-card border border-line bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <div>
            <label htmlFor={`${baseId}-title`} className="mb-1.5 block text-sm font-medium text-ink">
              Yeni görev
            </label>
            <input
              id={`${baseId}-title`}
              type="text"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setError(null);
              }}
              placeholder="Örn: Webhook imzasını test et"
              className={`min-h-11 w-full rounded-xl border bg-surface px-3.5 text-ink ${error ? "border-danger" : "border-line"}`}
            />
          </div>

          <div>
            <label htmlFor={`${baseId}-priority`} className="mb-1.5 block text-sm font-medium text-ink">
              Öncelik
            </label>
            <select
              id={`${baseId}-priority`}
              value={priority}
              onChange={(event) => setPriority(event.target.value as FeaturePriority)}
              className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-ink sm:w-32"
            >
              {PRIORITIES.map((item) => (
                <option key={item} value={item}>
                  {PRIORITY_LABELS[item]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`${baseId}-feature`} className="mb-1.5 block text-sm font-medium text-ink">
              Özellik
            </label>
            <select
              id={`${baseId}-feature`}
              value={featureId}
              onChange={(event) => setFeatureId(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-ink sm:w-44"
            >
              <option value="">Bağlı değil</option>
              {features.map((feature) => (
                <option key={feature.id} value={feature.id}>
                  {feature.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-strong"
        >
          <Plus size={16} aria-hidden="true" />
          Görev ekle
        </button>
      </form>

      <div role="group" aria-label="Görev filtresi" className="mt-4 flex gap-2">
        {(["all", "open", "done"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            className={`min-h-11 rounded-full px-4 text-sm font-medium transition-colors ${
              filter === value
                ? "bg-brand text-white"
                : "text-ink-soft ring-1 ring-line hover:text-brand"
            }`}
          >
            {value === "all" ? "Tümü" : value === "open" ? "Açık" : "Tamamlanan"}
          </button>
        ))}
      </div>

      <ul className="mt-3 space-y-2">
        {visible.length === 0 ? (
          <li className="rounded-card border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-ink-soft">
            Görev yok.
          </li>
        ) : (
          visible.map((task) => (
            <li
              key={task.id}
              className="flex items-center gap-3 rounded-card border border-line bg-surface p-3.5"
            >
              <input
                type="checkbox"
                id={`task-${task.id}`}
                checked={task.completed}
                onChange={() => onToggle(task)}
                className="h-5 w-5 shrink-0 accent-[var(--color-brand)]"
              />
              <label htmlFor={`task-${task.id}`} className="min-w-0 flex-1 cursor-pointer">
                <span
                  className={`block text-sm ${task.completed ? "text-ink-soft line-through" : "text-ink"}`}
                >
                  {task.title}
                </span>
                <span className="text-xs text-ink-soft">
                  {PRIORITY_LABELS[task.priority]}
                  {task.relatedFeatureId
                    ? ` · ${features.find((f) => f.id === task.relatedFeatureId)?.title ?? ""}`
                    : ""}
                </span>
              </label>
              <button
                type="button"
                onClick={() => onDelete(task)}
                aria-label={`${task.title} görevini sil`}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-line text-ink-soft transition-colors hover:border-danger hover:text-danger"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
