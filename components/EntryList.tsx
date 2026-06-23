"use client";

import type { Entry } from "@/lib/types";
import { formatTime } from "@/lib/store";

const MOOD_FACES = ["", "😞", "😕", "😐", "🙂", "😄"];
const norm = (s: string) => s.trim().toLocaleLowerCase("tr");

export default function EntryList({
  entries,
  excludeHabitNames,
  onToggle,
  onDelete,
  onEdit,
}: {
  entries: Entry[];
  excludeHabitNames?: Set<string>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit?: (entry: Entry) => void;
}) {
  let habits = entries.filter((e): e is Extract<Entry, { kind: "habit" }> => e.kind === "habit");
  if (excludeHabitNames) habits = habits.filter((e) => !excludeHabitNames.has(norm(e.name)));
  const tasks = entries.filter((e): e is Extract<Entry, { kind: "task" }> => e.kind === "task");
  const moods = entries.filter((e): e is Extract<Entry, { kind: "mood" }> => e.kind === "mood");
  const journals = entries.filter(
    (e): e is Extract<Entry, { kind: "journal" }> => e.kind === "journal"
  );
  const foods = entries.filter((e): e is Extract<Entry, { kind: "food" }> => e.kind === "food");

  return (
    <>
      <Section title="Alışkanlıklar" emoji="🔁" count={habits.length}>
        {habits.map((e) => (
          <Card
            key={e.id}
            accent="border-l-indigo-500"
            time={formatTime(e.createdAt)}
            source={srcFor(e.sourceText, e.name)}
            onEdit={onEdit ? () => onEdit(e) : undefined}
            onDelete={() => onDelete(e.id)}
          >
            <button onClick={() => onToggle(e.id)} className={check("rounded-full", e.done)}>
              {e.done ? "✓" : ""}
            </button>
            <span className="flex-1 font-medium capitalize">{e.name}</span>
            {e.amount != null && (
              <span className="text-sm text-[var(--muted)]">
                {e.amount} {e.unit}
              </span>
            )}
          </Card>
        ))}
      </Section>

      <Section title="Görevler" emoji="✅" count={tasks.length}>
        {tasks.map((e) => (
          <Card
            key={e.id}
            accent="border-l-emerald-500"
            time={formatTime(e.createdAt)}
            source={srcFor(e.sourceText, e.title)}
            onEdit={onEdit ? () => onEdit(e) : undefined}
            onDelete={() => onDelete(e.id)}
          >
            <button onClick={() => onToggle(e.id)} className={check("rounded-md", e.done)}>
              {e.done ? "✓" : ""}
            </button>
            <span className={`flex-1 ${e.done ? "text-[var(--muted)] line-through" : ""}`}>
              {e.title}
            </span>
          </Card>
        ))}
      </Section>

      <Section title="Ruh hali" emoji="💭" count={moods.length}>
        {moods.map((e) => (
          <Card
            key={e.id}
            accent="border-l-amber-500"
            time={formatTime(e.createdAt)}
            onEdit={onEdit ? () => onEdit(e) : undefined}
            onDelete={() => onDelete(e.id)}
          >
            <span className="text-2xl">{MOOD_FACES[e.score] ?? "🙂"}</span>
            <div className="min-w-0 flex-1">
              {e.label && <span className="font-medium capitalize">{e.label}</span>}
              {e.note && e.note !== e.label && (
                <p className="text-sm text-[var(--muted)]">{e.note}</p>
              )}
            </div>
          </Card>
        ))}
      </Section>

      <Section title="Günlük" emoji="📝" count={journals.length}>
        {journals.map((e) => (
          <Card
            key={e.id}
            accent="border-l-stone-400"
            time={formatTime(e.createdAt)}
            onEdit={onEdit ? () => onEdit(e) : undefined}
            onDelete={() => onDelete(e.id)}
          >
            <p className="min-w-0 flex-1 whitespace-pre-wrap leading-relaxed">{e.text}</p>
          </Card>
        ))}
      </Section>

      <Section title="Beslenme" emoji="🍽️" count={foods.length}>
        {foods.map((e) => (
          <Card
            key={e.id}
            accent="border-l-rose-500"
            time={formatTime(e.createdAt)}
            source={srcFor(e.sourceText, e.name)}
            onEdit={onEdit ? () => onEdit(e) : undefined}
            onDelete={() => onDelete(e.id)}
          >
            <div className="min-w-0 flex-1">
              <span className="font-medium capitalize">
                {e.name}
                {e.amount != null ? ` · ${e.amount} ${e.unit ?? ""}` : ""}
              </span>
              {!!(e.protein || e.carb || e.fat) && (
                <p className="text-xs text-[var(--muted)]">
                  P {e.protein ?? 0} · K {e.carb ?? 0} · Y {e.fat ?? 0} g
                </p>
              )}
            </div>
            <span className="shrink-0 text-sm font-semibold text-rose-500">{e.kcal} kcal</span>
          </Card>
        ))}
      </Section>
    </>
  );
}

/** Kaynak cümleyi yalnızca gösterilen değerden farklıysa göster. */
function srcFor(sourceText: string | undefined, shown: string): string | undefined {
  if (!sourceText) return undefined;
  const a = sourceText.trim().toLocaleLowerCase("tr");
  const b = shown.trim().toLocaleLowerCase("tr");
  if (a === b || a === b + "." || a.length < 4) return undefined;
  return sourceText;
}

function check(shape: string, done: boolean): string {
  return `grid h-6 w-6 shrink-0 place-items-center border-2 transition ${shape} ${
    done ? "border-indigo-500 bg-indigo-500 text-white" : "border-[var(--border)]"
  }`;
}

function Section({
  title,
  emoji,
  count,
  children,
}: {
  title: string;
  emoji: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
        <span>{emoji}</span>
        {title}
        <span className="rounded-full bg-[var(--card)] px-2 text-[var(--muted)] ring-1 ring-[var(--border)]">
          {count}
        </span>
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Card({
  children,
  onDelete,
  onEdit,
  accent,
  time,
  source,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  onEdit?: () => void;
  accent?: string;
  time?: string;
  source?: string;
}) {
  return (
    <div
      className={`group rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition hover:shadow-md ${
        accent ? `border-l-4 ${accent}` : ""
      }`}
    >
      <div className="flex items-center gap-3">
        {children}
        {time && (
          <span className="shrink-0 text-[11px] tabular-nums text-[var(--muted)]">{time}</span>
        )}
        {onEdit && (
          <button
            onClick={onEdit}
            className="-m-1 shrink-0 p-1 text-[var(--muted)] opacity-50 transition hover:opacity-100"
            aria-label="Düzenle"
          >
            ✎
          </button>
        )}
        <button
          onClick={onDelete}
          className="-m-1 shrink-0 p-1 text-[var(--muted)] opacity-50 transition hover:opacity-100"
          aria-label="Sil"
        >
          ✕
        </button>
      </div>
      {source && (
        <p className="mt-1.5 truncate text-xs italic text-[var(--muted)]">“{source}”</p>
      )}
    </div>
  );
}
