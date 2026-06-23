"use client";

import { useState } from "react";
import type { Entry } from "@/lib/types";

const KINDS: { k: Entry["kind"]; label: string; emoji: string }[] = [
  { k: "habit", label: "Alışkanlık", emoji: "🔁" },
  { k: "task", label: "Görev", emoji: "✅" },
  { k: "food", label: "Beslenme", emoji: "🍽️" },
  { k: "mood", label: "Ruh hali", emoji: "💭" },
  { k: "journal", label: "Günlük", emoji: "📝" },
];

const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-indigo-400";

export default function EntryEditor({
  entry,
  onClose,
  onSave,
}: {
  entry: Entry;
  onClose: () => void;
  onSave: (e: Entry) => void;
}) {
  const [kind, setKind] = useState<Entry["kind"]>(entry.kind);
  const [f, setF] = useState(() => ({
    name: entry.kind === "habit" || entry.kind === "food" ? entry.name : "",
    amount:
      (entry.kind === "habit" || entry.kind === "food") && entry.amount != null
        ? String(entry.amount)
        : "",
    unit: entry.kind === "habit" || entry.kind === "food" ? entry.unit ?? "" : "",
    done: entry.kind === "habit" || entry.kind === "task" ? entry.done : false,
    title: entry.kind === "task" ? entry.title : "",
    score: entry.kind === "mood" ? entry.score : 3,
    label: entry.kind === "mood" ? entry.label ?? "" : "",
    note: entry.kind === "mood" ? entry.note ?? "" : "",
    text: entry.kind === "journal" ? entry.text : "",
    kcal: entry.kind === "food" ? String(entry.kcal) : "",
    protein: entry.kind === "food" && entry.protein != null ? String(entry.protein) : "",
    carb: entry.kind === "food" && entry.carb != null ? String(entry.carb) : "",
    fat: entry.kind === "food" && entry.fat != null ? String(entry.fat) : "",
  }));

  const set = (patch: Partial<typeof f>) => setF((s) => ({ ...s, ...patch }));
  const num = (s: string) => {
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : undefined;
  };

  function build(): Entry | null {
    const base = {
      id: entry.id,
      createdAt: entry.createdAt,
      date: entry.date,
      sourceText: entry.sourceText,
    };
    switch (kind) {
      case "habit":
        return f.name.trim()
          ? { ...base, kind: "habit", name: f.name.trim(), amount: num(f.amount), unit: f.unit.trim() || undefined, done: f.done }
          : null;
      case "task":
        return f.title.trim() ? { ...base, kind: "task", title: f.title.trim(), done: f.done } : null;
      case "food":
        return f.name.trim()
          ? {
              ...base,
              kind: "food",
              name: f.name.trim(),
              amount: num(f.amount),
              unit: f.unit.trim() || undefined,
              kcal: num(f.kcal) ?? 0,
              protein: num(f.protein),
              carb: num(f.carb),
              fat: num(f.fat),
            }
          : null;
      case "mood":
        return { ...base, kind: "mood", score: f.score, label: f.label.trim() || undefined, note: f.note.trim() || undefined };
      case "journal":
        return f.text.trim() ? { ...base, kind: "journal", text: f.text.trim() } : null;
    }
    return null;
  }

  const draft = build();

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-pop safe-bottom max-h-[85dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-[var(--card)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[var(--border)]" />
        <h2 className="mb-3 text-lg font-bold">Kaydı düzenle</h2>

        {/* tür seçici (yeniden kategorize) */}
        <div className="mb-4 grid grid-cols-5 gap-1.5">
          {KINDS.map((x) => (
            <button
              key={x.k}
              onClick={() => setKind(x.k)}
              className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] ring-1 transition ${
                kind === x.k ? "bg-indigo-500 text-white ring-indigo-500" : "text-[var(--muted)] ring-[var(--border)]"
              }`}
            >
              <span className="text-base">{x.emoji}</span>
              {x.label}
            </button>
          ))}
        </div>

        {/* alanlar */}
        <div className="space-y-2">
          {(kind === "habit" || kind === "food") && (
            <input className={inputCls} placeholder="Ad (ör. koşu / döner)" value={f.name} onChange={(e) => set({ name: e.target.value })} />
          )}
          {kind === "task" && (
            <input className={inputCls} placeholder="Görev başlığı" value={f.title} onChange={(e) => set({ title: e.target.value })} />
          )}
          {(kind === "habit" || kind === "food") && (
            <div className="grid grid-cols-2 gap-2">
              <input className={inputCls} inputMode="decimal" placeholder="Miktar" value={f.amount} onChange={(e) => set({ amount: e.target.value })} />
              <input className={inputCls} placeholder="Birim (dk, porsiyon…)" value={f.unit} onChange={(e) => set({ unit: e.target.value })} />
            </div>
          )}
          {kind === "food" && (
            <div className="grid grid-cols-4 gap-2">
              <NumField label="kcal" v={f.kcal} on={(v) => set({ kcal: v })} />
              <NumField label="P (g)" v={f.protein} on={(v) => set({ protein: v })} />
              <NumField label="K (g)" v={f.carb} on={(v) => set({ carb: v })} />
              <NumField label="Y (g)" v={f.fat} on={(v) => set({ fat: v })} />
            </div>
          )}
          {(kind === "habit" || kind === "task") && (
            <label className="flex items-center gap-2 py-1 text-sm">
              <input type="checkbox" checked={f.done} onChange={(e) => set({ done: e.target.checked })} className="h-4 w-4" />
              Tamamlandı
            </label>
          )}
          {kind === "mood" && (
            <>
              <div className="flex items-center justify-between gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    onClick={() => set({ score: s })}
                    className={`flex-1 rounded-xl py-2 text-xl ring-1 transition ${
                      f.score === s ? "bg-amber-400/20 ring-amber-400" : "ring-[var(--border)]"
                    }`}
                  >
                    {["😞", "😕", "😐", "🙂", "😄"][s - 1]}
                  </button>
                ))}
              </div>
              <input className={inputCls} placeholder="Etiket (ör. yorgun)" value={f.label} onChange={(e) => set({ label: e.target.value })} />
              <input className={inputCls} placeholder="Not (opsiyonel)" value={f.note} onChange={(e) => set({ note: e.target.value })} />
            </>
          )}
          {kind === "journal" && (
            <textarea
              className={`${inputCls} min-h-[6rem] leading-relaxed`}
              placeholder="Günlük metni"
              value={f.text}
              onChange={(e) => set({ text: e.target.value })}
            />
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl py-2.5 text-sm font-medium ring-1 ring-[var(--border)]">
            İptal
          </button>
          <button
            onClick={() => draft && onSave(draft)}
            disabled={!draft}
            className="flex-1 rounded-xl bg-indigo-500 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}

function NumField({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] text-[var(--muted)]">{label}</span>
      <input
        inputMode="decimal"
        value={v}
        onChange={(e) => on(e.target.value)}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm outline-none focus:border-indigo-400"
      />
    </label>
  );
}
