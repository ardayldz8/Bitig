"use client";

import { useEffect, useState } from "react";
import type { Entry, Quest, QuestSpec } from "@/lib/types";
import { itemToEntry, dayKey, uid } from "@/lib/store";
import { insertEntries, deleteEntry } from "@/lib/db";

export default function Quests({
  userId,
  entries,
  onChanged,
}: {
  userId: string;
  entries: Entry[];
  onChanged: () => Promise<void> | void;
}) {
  const [quests, setQuests] = useState<Quest[] | null>(null);
  const [loading, setLoading] = useState(false);
  const key = `duzen.quests.${userId}.${dayKey()}`;

  useEffect(() => {
    let cached: Quest[] | null = null;
    try {
      const raw = localStorage.getItem(key);
      if (raw) cached = JSON.parse(raw);
    } catch {
      cached = null;
    }
    if (cached && cached.length) setQuests(cached);
    else generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  function save(qs: Quest[]) {
    setQuests(qs);
    try {
      localStorage.setItem(key, JSON.stringify(qs));
    } catch {
      // yoksay
    }
  }

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch("/api/quests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: entries.slice(0, 80), today: dayKey() }),
      });
      const data = await res.json();
      const specs: QuestSpec[] = Array.isArray(data.quests) ? data.quests : [];
      save(specs.map((s) => ({ ...s, id: uid(), done: false })));
    } catch {
      setQuests([]);
    } finally {
      setLoading(false);
    }
  }

  function toggle(q: Quest) {
    if (!quests) return;
    if (!q.done) {
      // tamamla: kaydı oluştur, id'sini sakla (geri alma için)
      const entry = itemToEntry(q.item);
      save(quests.map((x) => (x.id === q.id ? { ...x, done: true, entryId: entry.id } : x)));
      insertEntries([entry], userId)
        .then(() => onChanged())
        .catch(() =>
          save(quests.map((x) => (x.id === q.id ? { ...x, done: false, entryId: undefined } : x)))
        );
    } else {
      // geri al: tamamlanınca oluşan kaydı sil
      const eid = q.entryId;
      save(quests.map((x) => (x.id === q.id ? { ...x, done: false, entryId: undefined } : x)));
      Promise.resolve(eid ? deleteEntry(eid) : undefined)
        .then(() => onChanged())
        .catch(() => {});
    }
  }

  const doneCount = quests?.filter((q) => q.done).length ?? 0;
  const total = quests?.length ?? 0;
  const allDone = total > 0 && doneCount === total;

  return (
    <section>
      <div className="rounded-2xl bg-slate-900 p-4 text-cyan-50 shadow-[0_0_24px_-10px_rgba(34,211,238,0.5)] ring-1 ring-cyan-400/40">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-400/80">
            ⟦ Günün Questleri ⟧
          </span>
          <span className="text-[11px] text-cyan-300/60">
            {total > 0 ? `${doneCount}/${total}` : ""}
          </span>
        </div>

        {loading && (
          <div className="flex items-center gap-2 py-4 text-sm text-cyan-300/70">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
            Questler hazırlanıyor…
          </div>
        )}

        {!loading && quests && quests.length > 0 && (
          <div className="space-y-2">
            {quests.map((q) => (
              <button
                key={q.id}
                onClick={() => toggle(q)}
                className={`flex w-full items-center gap-3 rounded-xl p-3 text-left ring-1 transition active:scale-[0.99] ${
                  q.done ? "bg-cyan-400/5 ring-cyan-400/20" : "bg-cyan-400/10 ring-cyan-400/30"
                }`}
              >
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 text-xs ${
                    q.done
                      ? "border-cyan-400 bg-cyan-400 text-slate-900"
                      : "border-cyan-400/50"
                  }`}
                >
                  {q.done ? "✓" : ""}
                </span>
                <span className={`flex-1 text-sm ${q.done ? "text-cyan-300/40 line-through" : ""}`}>
                  {q.text}
                </span>
                <span className="shrink-0 rounded-full bg-cyan-400/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-cyan-300">
                  {q.stat}
                </span>
              </button>
            ))}
          </div>
        )}

        {!loading && allDone && (
          <p className="mt-3 text-center text-sm font-medium text-cyan-300">
            ⟪ Tüm questler tamamlandı! ⟫
          </p>
        )}

        {!loading && quests && quests.length === 0 && (
          <p className="py-2 text-sm text-cyan-300/60">Quest alınamadı.</p>
        )}

        {!loading && quests && quests.length > 0 && (
          <p className="mt-2 text-[11px] text-cyan-300/40">
            Yanlış işaretlediysen tamamlanan queste tekrar dokun — geri alınır.
          </p>
        )}

        <button
          onClick={generate}
          disabled={loading}
          className="mt-3 text-xs text-cyan-300/60 underline disabled:opacity-40"
        >
          Questleri yenile
        </button>
      </div>
    </section>
  );
}
