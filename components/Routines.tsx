"use client";

import { useState } from "react";
import type { Entry, Routine } from "@/lib/types";
import { itemToEntry, dayKey } from "@/lib/store";
import { insertEntries, deleteEntry } from "@/lib/db";

const norm = (s: string) => s.trim().toLocaleLowerCase("tr");

export default function Routines({
  routines,
  entries,
  userId,
  onChanged,
  onAdd,
  onDelete,
}: {
  routines: Routine[];
  entries: Entry[];
  userId: string;
  onChanged: () => Promise<void> | void;
  onAdd: (name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const today = dayKey();

  function todayEntryFor(r: Routine): Entry | undefined {
    return entries.find(
      (e) => e.kind === "habit" && e.date === today && e.done && norm(e.name) === norm(r.name)
    );
  }

  function toggle(r: Routine) {
    const existing = todayEntryFor(r);
    if (existing) {
      deleteEntry(existing.id)
        .then(() => onChanged())
        .catch(() => {});
    } else {
      insertEntries([itemToEntry({ kind: "habit", name: r.name, done: true })], userId)
        .then(() => onChanged())
        .catch(() => {});
    }
  }

  function submitAdd() {
    const n = name.trim();
    if (!n) return;
    onAdd(n);
    setName("");
    setAdding(false);
  }

  const doneCount = routines.filter((r) => todayEntryFor(r)).length;

  return (
    <section className="mt-2">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          🔁 Günlük rutin{routines.length > 0 ? ` · ${doneCount}/${routines.length}` : ""}
        </h2>
        <button
          onClick={() => setAdding((a) => !a)}
          className="text-sm font-medium text-indigo-500"
        >
          + ekle
        </button>
      </div>

      {adding && (
        <div className="mb-2 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitAdd()}
            placeholder="ör. su, spor, okuma, meditasyon"
            autoFocus
            className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
          <button
            onClick={submitAdd}
            className="rounded-xl bg-indigo-500 px-4 text-sm font-medium text-white"
          >
            Ekle
          </button>
        </div>
      )}

      {routines.length === 0
        ? !adding && (
            <p className="text-sm text-[var(--muted)]">
              Her gün tekrarlayan alışkanlıklarını ekle (su, spor…) — burada günlük checklist olarak çıkar.
            </p>
          )
        : (
            <div className="space-y-2">
              {routines.map((r) => {
                const done = !!todayEntryFor(r);
                return (
                  <div
                    key={r.id}
                    className="group flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm"
                  >
                    <button
                      onClick={() => toggle(r)}
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition ${
                        done ? "border-indigo-500 bg-indigo-500 text-white" : "border-[var(--border)]"
                      }`}
                    >
                      {done ? "✓" : ""}
                    </button>
                    <span className={`flex-1 font-medium capitalize ${done ? "text-[var(--muted)]" : ""}`}>
                      {r.emoji ? `${r.emoji} ` : ""}
                      {r.name}
                    </span>
                    <button
                      onClick={() => onDelete(r.id)}
                      className="shrink-0 text-[var(--muted)] opacity-60 transition hover:opacity-100"
                      aria-label="Rutini sil"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
    </section>
  );
}
