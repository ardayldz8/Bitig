"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatAction, ChatResponse, Entry, Goal } from "@/lib/types";
import { itemToEntry, dayKey, uid, similar, entryText } from "@/lib/store";
import { authHeaders } from "@/lib/api";
import { notificationsEnabled } from "@/lib/push";
import {
  insertEntries,
  setDone,
  deleteEntry,
  insertReminder,
  insertGoal,
  updateEntryContent,
  updateFoodNutrition,
  insertDungeon,
  fetchChatMessages,
  insertChatMessages,
  clearChatMessages,
} from "@/lib/db";

interface Msg {
  role: "user" | "assistant";
  text: string;
  note?: string; // uygulanan işlemlerin kısa özeti
}

function actionsNote(actions: ChatAction[]): string | undefined {
  const adds = actions.filter((a) => a.type === "add").length;
  const done = actions.filter((a) => a.type === "complete").length;
  const dels = actions.filter((a) => a.type === "delete").length;
  const edits = actions.filter((a) => a.type === "edit").length;
  const rem = actions.filter((a) => a.type === "reminder").length;
  const food = actions.filter((a) => a.type === "food").length;
  const dun = actions.filter((a) => a.type === "dungeon").length;
  const parts: string[] = [];
  if (adds) parts.push(`➕ ${adds}`);
  if (food) parts.push(`🍽 ${food}`);
  if (dun) parts.push(`⛩ ${dun}`);
  if (done) parts.push(`✓ ${done}`);
  if (edits) parts.push(`✎ ${edits}`);
  if (dels) parts.push(`🗑 ${dels}`);
  if (rem) parts.push(`⏰ ${rem}`);
  return parts.length ? parts.join(" · ") : undefined;
}

const QUICK = ["Su içtim", "Spor yaptım", "Bugün nasıl gidiyor?", "Kaç kalori kaldı?", "Yarın hatırlat: "];

export default function Chat({
  userId,
  entries,
  goals,
  calorieTarget,
  onChanged,
}: {
  userId: string;
  entries: Entry[];
  goals: Goal[];
  calorieTarget: number | null;
  onChanged: () => Promise<void> | void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const key = `duzen.chat.${userId}`;

  useEffect(() => {
    // Hızlı: yerel önbellek
    try {
      const raw = localStorage.getItem(key);
      if (raw) setMessages(JSON.parse(raw));
    } catch {
      // yoksay
    }
    setLoaded(true);
    // Yetkili kaynak: bulut (cihazlar arası) — varsa yereli geçersiz kıl
    fetchChatMessages()
      .then((rows) => {
        if (rows.length) setMessages(rows);
      })
      .catch(() => {});
  }, [key]);

  useEffect(() => {
    if (loaded) {
      try {
        localStorage.setItem(key, JSON.stringify(messages.slice(-50)));
      } catch {
        // yoksay
      }
    }
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, loaded, key]);

  async function applyActions(actions: ChatAction[]) {
    const ids = new Set(entries.map((e) => e.id));

    const toAdd: Entry[] = [];
    let skipped = 0;
    for (const a of actions) {
      let entry: Entry | undefined;
      if (a.type === "add") {
        entry = itemToEntry(a.item);
        if (a.date) entry.date = a.date;
      } else if (a.type === "food") {
        entry = itemToEntry({
          kind: "food",
          name: a.name,
          amount: a.amount,
          unit: a.unit,
          kcal: a.kcal,
          protein: a.protein,
          carb: a.carb,
          fat: a.fat,
        });
      }
      if (!entry) continue;
      const e = entry;
      // Aynı gün + tür içinde çok benzer (mükerrer) kaydı atla
      const dup = [...entries, ...toAdd].some(
        (x) => x.kind === e.kind && x.date === e.date && similar(entryText(x), entryText(e)) > 0.7
      );
      if (!dup) toAdd.push(e);
      else skipped++;
    }
    const ops: Promise<unknown>[] = [];
    if (toAdd.length) ops.push(insertEntries(toAdd, userId));
    for (const a of actions) {
      if (a.type === "complete" && ids.has(a.id)) ops.push(setDone(a.id, a.done));
      else if (a.type === "delete" && ids.has(a.id)) ops.push(deleteEntry(a.id));
      else if (a.type === "edit" && ids.has(a.id)) {
        const cur = entries.find((x) => x.id === a.id);
        const e = itemToEntry(a.item);
        if (cur) e.date = cur.date; // orijinal günü koru
        ops.push(updateEntryContent(a.id, e));
      } else if (a.type === "reminder") {
        const at = new Date(a.at);
        if (!Number.isNaN(at.getTime()))
          ops.push(insertReminder({ id: uid(), text: a.text, remind_at: at.toISOString() }, userId));
      } else if (a.type === "goal") {
        ops.push(
          insertGoal(
            {
              id: uid(),
              title: a.title,
              habit: a.habit,
              target: a.target,
              period: a.period,
              metric: a.metric ?? "count",
              unit: a.unit,
            },
            userId
          )
        );
      } else if (a.type === "dungeon") {
        ops.push(
          insertDungeon(
            {
              id: uid(),
              name: a.name,
              rank: a.rank ?? "E",
              boss: a.boss,
              steps: a.steps.map((t) => ({ id: uid(), text: t, done: false })),
              completedAt: null,
            },
            userId
          )
        );
      }
    }
    const settled = await Promise.allSettled(ops);
    const failed = settled.filter((s) => s.status === "rejected").length;
    await onChanged();
    // Yemek kayıtlarının kalorisini web araştırmasıyla arka planda doğrula/güncelle
    const foodEntries = toAdd.filter(
      (e): e is Extract<Entry, { kind: "food" }> => e.kind === "food"
    );
    if (foodEntries.length) void researchFood(foodEntries);
    return { failed, skipped };
  }

  async function researchFood(foods: Extract<Entry, { kind: "food" }>[]) {
    try {
      const res = await fetch("/api/food-research", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          items: foods.map((f) => ({ name: f.name, amount: f.amount, unit: f.unit })),
        }),
      });
      const data = await res.json();
      const results = data?.results;
      if (!Array.isArray(results) || !results.length) return;
      await Promise.allSettled(
        foods.map((f, i) => {
          const r = results[i];
          if (!r || !r.kcal) return Promise.resolve(); // araştırma bulamadıysa model tahmini kalsın
          return updateFoodNutrition(f.id, r);
        })
      );
      await onChanged();
    } catch {
      // yoksay
    }
  }

  async function send() {
    const value = input.trim();
    if (!value || busy) return;
    const history = messages;
    setMessages((m) => [...m, { role: "user", text: value }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          message: value,
          history,
          entries: entries.slice(0, 150),
          today: dayKey(),
          now: new Date().toLocaleString("sv-SE"),
          goals,
          calorieTarget,
        }),
      });
      const data: ChatResponse = await res.json();
      const actions = Array.isArray(data.actions) ? data.actions : [];
      let warn = "";
      if (actions.length) {
        const r = await applyActions(actions);
        if (r.skipped) warn += `\n\n(${r.skipped} çok benzer kayıt mükerrer sayılıp atlandı.)`;
        if (r.failed) warn += `\n\n⚠️ ${r.failed} işlem kaydedilemedi — tekrar dener misin?`;
      }
      if (actions.some((a) => a.type === "reminder") && !(await notificationsEnabled())) {
        warn += `\n\n🔔 Bildirimler kapalı — hatırlatma gelmeyebilir. Özet → Bildirimler'den aç.`;
      }
      const reply = (data.reply || "Tamam.") + warn;
      const note = actionsNote(actions);
      setMessages((m) => [...m, { role: "assistant", text: reply, note }]);
      // Buluta kaydet (cihazlar arası + analiz)
      insertChatMessages(
        [
          { role: "user", text: value },
          { role: "assistant", text: reply, note },
        ],
        userId
      ).catch(() => {});
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "Bir aksilik oldu, tekrar dener misin?" },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function clearChat() {
    setMessages([]);
    try {
      localStorage.removeItem(key);
    } catch {
      // yoksay
    }
    clearChatMessages(userId).catch(() => {});
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="mx-auto mt-6 max-w-sm rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 text-center shadow-sm">
            <div className="mb-2 text-4xl">👋</div>
            <p className="font-medium">Merhaba! Ben Bitig asistanın.</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Bana gününü anlat, soru sor ya da işini söyle — gerisini ben hallederim:
            </p>
            <div className="mt-3 space-y-1.5 text-left text-sm">
              {[
                "Bugün 45 dk koştum ve kafam biraz dağınık",
                "Raporu bitirdim",
                "Bu hafta kaç kez spor yaptım?",
                "Yarın su içmeyi hatırlat",
              ].map((t) => (
                <Example
                  key={t}
                  t={t}
                  onPick={(x) => {
                    setInput(x);
                    inputRef.current?.focus();
                  }}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m, i) => (
              <Bubble key={i} m={m} />
            ))}
          </div>
        )}
        {busy && (
          <div className="mt-3 flex items-center gap-2 px-1 text-sm text-[var(--muted)]">
            <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--muted)] [animation-delay:-0.2s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--muted)] [animation-delay:-0.1s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--muted)]" />
            <span className="ml-1">yazıyor…</span>
          </div>
        )}
      </div>

      <div className="safe-bottom shrink-0 px-3 pt-2">
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="mb-2 ml-1 text-xs text-[var(--muted)] underline"
          >
            Sohbeti temizle
          </button>
        )}
        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5">
          {QUICK.map((q) => (
            <button
              key={q}
              onClick={() => {
                setInput(q);
                inputRef.current?.focus();
              }}
              className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs text-[var(--muted)] transition active:scale-95"
            >
              {q}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-lg">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="Asistana yaz… (ör. 2 saat ders çalıştım, kahve içtim)"
            className="max-h-32 min-h-[2.75rem] flex-1 resize-none bg-transparent px-3 py-2.5 leading-snug outline-none placeholder:text-[var(--muted)]"
          />
          <button
            onClick={send}
            disabled={busy || !input.trim()}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-indigo-500 text-white shadow-sm transition active:scale-95 disabled:opacity-40"
            aria-label="Gönder"
          >
            {busy ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 19V5M5 12l7-7 7 7"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Bubble({ m }: { m: Msg }) {
  const isUser = m.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[82%] rounded-2xl px-4 py-2.5 leading-relaxed shadow-sm ${
          isUser
            ? "rounded-br-md bg-indigo-500 text-white"
            : "rounded-bl-md border border-[var(--border)] bg-[var(--card)]"
        }`}
      >
        <p className="whitespace-pre-wrap">{m.text}</p>
        {m.note && (
          <p className={`mt-1 text-xs ${isUser ? "text-white/70" : "text-[var(--muted)]"}`}>
            {m.note}
          </p>
        )}
      </div>
    </div>
  );
}

function Example({ t, onPick }: { t: string; onPick: (t: string) => void }) {
  return (
    <button
      onClick={() => onPick(t)}
      className="block w-full rounded-xl bg-[var(--background)] px-3 py-1.5 text-left text-[var(--muted)] ring-1 ring-[var(--border)] transition active:scale-[0.99]"
    >
      “{t}”
    </button>
  );
}
