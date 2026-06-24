"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Entry, Reminder, Goal, Routine, Profile, Dungeon, Facet } from "@/lib/types";
import { dayKey, uid, itemToEntry, entryText } from "@/lib/store";
import { authHeaders } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import {
  fetchEntries,
  setDone,
  deleteEntry,
  fetchReminders,
  deleteReminder,
  fetchGoals,
  deleteGoal,
  fetchRoutines,
  insertRoutine,
  deleteRoutine,
  fetchProfile,
  upsertProfile,
  updateEntryContent,
  insertEntries,
  fetchDungeons,
  insertDungeon,
  updateDungeon,
  deleteDungeon,
} from "@/lib/db";
import {
  notificationsSupported,
  notificationsEnabled,
  enableNotifications,
  disableNotifications,
} from "@/lib/push";
import Login from "@/components/Login";
import Chat from "@/components/Chat";
import Stats from "@/components/Stats";
import Routines from "@/components/Routines";
import EntryList from "@/components/EntryList";
import CalorieRing from "@/components/CalorieRing";
import ProfileForm from "@/components/ProfileForm";
import EntryEditor from "@/components/EntryEditor";
import Dungeons from "@/components/Dungeons";
import { computeScore } from "@/lib/score";
import { computeTargets } from "@/lib/nutrition";
import { computeAchievements } from "@/lib/achievements";

type Tab = "chat" | "today" | "past" | "analiz";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [tab, setTab] = useState<Tab>("chat");
  const [toast, setToast] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [insightBusy, setInsightBusy] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notifOn, setNotifOn] = useState(false);
  const [notifBusy, setNotifBusy] = useState(false);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [newAch, setNewAch] = useState<{ emoji: string; name: string } | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [dungeons, setDungeons] = useState<Dungeon[]>([]);
  const [dungeonCleared, setDungeonCleared] = useState<{ name: string; rank: string } | null>(null);
  const [pw, setPw] = useState("");
  const [facets, setFacets] = useState<Facet[]>([]);
  const [pastFacet, setPastFacet] = useState<string>("all");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setEntries([]);
      setReminders([]);
      setGoals([]);
      setRoutines([]);
      setProfile(null);
      setDungeons([]);
      return;
    }
    let active = true;
    Promise.all([
      fetchEntries(),
      fetchReminders(),
      fetchGoals(),
      fetchRoutines(),
      fetchProfile(),
      fetchDungeons(),
    ])
      .then(([es, rs, gs, rt, pr, dn]) => {
        if (active) {
          setEntries(es);
          setReminders(rs);
          setGoals(gs);
          setRoutines(rt);
          setProfile(pr);
          setDungeons(dn);
        }
      })
      .catch(() => active && flash("Kayıtlar yüklenemedi"));
    notificationsEnabled().then((on) => active && setNotifOn(on));
    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  // Geçmiş için AI'nın ürettiği akıllı filtreler (günlük önbellekli)
  useEffect(() => {
    fetchFacets(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, entries.length]);

  async function reload() {
    try {
      const [es, rs, gs, rt, pr, dn] = await Promise.all([
        fetchEntries(),
        fetchReminders(),
        fetchGoals(),
        fetchRoutines(),
        fetchProfile(),
        fetchDungeons(),
      ]);
      setEntries(es);
      setReminders(rs);
      setGoals(gs);
      setRoutines(rt);
      setProfile(pr);
      setDungeons(dn);
    } catch {
      flash("Senkron hatası");
    }
  }

  const today = dayKey();
  const todays = useMemo(() => entries.filter((e) => e.date === today), [entries, today]);
  const past = useMemo(() => entries.filter((e) => e.date !== today), [entries, today]);
  const pastByDay = useMemo(() => {
    const m = new Map<string, Entry[]>();
    for (const e of past) {
      const arr = m.get(e.date) ?? [];
      arr.push(e);
      m.set(e.date, arr);
    }
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [past]);

  const dateStr = new Date().toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const score = computeScore(entries);
  const achievements = computeAchievements(entries, routines, goals);
  const unlockedKey = achievements
    .filter((a) => a.unlocked)
    .map((a) => a.id)
    .join(",");

  // Seviye atlama bildirimi — cihazda en son görülen seviyeyi sakla, ilk yüklemede bildirme
  useEffect(() => {
    if (!session) return;
    const key = `duzen.level.${session.user.id}`;
    const stored = Number(localStorage.getItem(key) || "0");
    if (!stored) {
      localStorage.setItem(key, String(score.level));
      return;
    }
    if (score.level > stored) {
      setLevelUp(score.level);
      window.setTimeout(() => setLevelUp(null), 3400);
    }
    if (score.level !== stored) localStorage.setItem(key, String(score.level));
  }, [score.level, session?.user?.id]);

  // Başarım açılma bildirimi
  useEffect(() => {
    if (!session) return;
    const key = `duzen.ach.${session.user.id}`;
    const raw = localStorage.getItem(key);
    const ids = achievements.filter((a) => a.unlocked).map((a) => a.id);
    if (raw === null) {
      localStorage.setItem(key, JSON.stringify(ids));
      return;
    }
    let stored: string[] = [];
    try {
      stored = JSON.parse(raw);
    } catch {
      stored = [];
    }
    const storedSet = new Set(stored);
    const fresh = achievements.filter((a) => a.unlocked && !storedSet.has(a.id));
    if (fresh.length > 0) {
      setNewAch({ emoji: fresh[0].emoji, name: fresh[0].name });
      window.setTimeout(() => setNewAch(null), 3200);
      localStorage.setItem(key, JSON.stringify(ids));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlockedKey, session?.user?.id]);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }

  function toggleDone(id: string) {
    const cur = entries.find((e) => e.id === id);
    if (!cur || (cur.kind !== "habit" && cur.kind !== "task")) return;
    const next = !cur.done;
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id && (e.kind === "habit" || e.kind === "task") ? { ...e, done: next } : e
      )
    );
    setDone(id, next).catch(() => {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === id && (e.kind === "habit" || e.kind === "task") ? { ...e, done: !next } : e
        )
      );
      flash("Güncellenemedi");
    });
  }

  function remove(id: string) {
    const snapshot = entries;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    deleteEntry(id).catch(() => {
      setEntries(snapshot);
      flash("Silinemedi");
    });
  }

  async function openInsight() {
    setSheetOpen(true);
    setInsight(null);
    setInsightBusy(true);
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ entries }),
      });
      const data = await res.json();
      setInsight(data.summary ?? "Özet oluşturulamadı.");
    } catch {
      setInsight("Özet alınamadı. İnternet bağlantını kontrol et.");
    } finally {
      setInsightBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSheetOpen(false);
  }

  async function changePassword() {
    if (pw.length < 6) {
      flash("Şifre en az 6 karakter olmalı");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) flash("Olmadı: " + error.message);
    else {
      setPw("");
      flash("Şifre belirlendi ✓ Artık şifreyle girebilirsin");
    }
  }

  function fetchFacets(force: boolean) {
    if (!session) return;
    const ck = `bitig.facets.${session.user.id}.${dayKey()}`;
    if (!force) {
      try {
        const raw = localStorage.getItem(ck);
        if (raw) {
          setFacets(JSON.parse(raw));
          return;
        }
      } catch {
        // yoksay
      }
    }
    const pastEntries = entries.filter((e) => e.date !== dayKey());
    if (!pastEntries.length) {
      setFacets([]);
      return;
    }
    fetch("/api/facets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: pastEntries.slice(0, 120) }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.facets)) {
          setFacets(d.facets);
          try {
            localStorage.setItem(ck, JSON.stringify(d.facets));
          } catch {
            // yoksay
          }
        }
      })
      .catch(() => {});
  }

  async function toggleNotif() {
    if (!session) return;
    setNotifBusy(true);
    try {
      if (notifOn) {
        await disableNotifications();
        setNotifOn(false);
        flash("Bildirimler kapatıldı");
      } else {
        const res = await enableNotifications(session.user.id);
        if (res.ok) {
          setNotifOn(true);
          flash("Bildirimler açıldı ✓");
        } else {
          flash(res.error || "Açılamadı");
        }
      }
    } finally {
      setNotifBusy(false);
    }
  }

  function removeReminder(id: string) {
    const snap = reminders;
    setReminders((prev) => prev.filter((r) => r.id !== id));
    deleteReminder(id).catch(() => {
      setReminders(snap);
      flash("Silinemedi");
    });
  }

  function removeGoal(id: string) {
    const snap = goals;
    setGoals((prev) => prev.filter((g) => g.id !== id));
    deleteGoal(id).catch(() => {
      setGoals(snap);
      flash("Silinemedi");
    });
  }

  function addRoutine(name: string) {
    if (!session) return;
    const r: Routine = { id: uid(), name };
    setRoutines((prev) => [...prev, r]);
    insertRoutine(r, session.user.id).catch(() => {
      setRoutines((prev) => prev.filter((x) => x.id !== r.id));
      flash("Eklenemedi");
    });
  }

  function removeRoutine(id: string) {
    const snap = routines;
    setRoutines((prev) => prev.filter((r) => r.id !== id));
    deleteRoutine(id).catch(() => {
      setRoutines(snap);
      flash("Silinemedi");
    });
  }

  function saveProfile(p: Profile) {
    setProfile(p);
    if (session) upsertProfile(p, session.user.id).catch(() => flash("Profil kaydedilemedi"));
  }

  function saveEntryEdit(e: Entry) {
    setEntries((prev) => prev.map((x) => (x.id === e.id ? e : x)));
    setEditing(null);
    updateEntryContent(e.id, e)
      .then(() => reload())
      .catch(() => {
        flash("Kaydedilemedi");
        reload();
      });
  }

  function addDungeon(d: Dungeon) {
    if (!session) return;
    setDungeons((prev) => [d, ...prev]);
    insertDungeon(d, session.user.id).catch(() => {
      setDungeons((prev) => prev.filter((x) => x.id !== d.id));
      flash("Zindan eklenemedi");
    });
  }

  function toggleDungeonStep(dungeonId: string, stepId: string) {
    if (!session) return;
    const d = dungeons.find((x) => x.id === dungeonId);
    if (!d) return;
    const steps = d.steps.map((s) => (s.id === stepId ? { ...s, done: !s.done } : s));
    const allDone = steps.length > 0 && steps.every((s) => s.done);
    const justCleared = allDone && !d.completedAt;
    const completedAt = justCleared ? new Date().toISOString() : d.completedAt ?? null;
    setDungeons((prev) => prev.map((x) => (x.id === dungeonId ? { ...x, steps, completedAt } : x)));
    updateDungeon(dungeonId, { steps, completedAt }).catch(() => {
      flash("Güncellenemedi");
      reload();
    });
    if (justCleared) {
      // ödül: tamamlanan görev kaydı (+XP) + kutlama efekti
      const reward = itemToEntry({
        kind: "task",
        title: `🏰 ${d.name} — Zindan temizlendi`,
        done: true,
      });
      insertEntries([reward], session.user.id)
        .then(() => reload())
        .catch(() => {});
      setDungeonCleared({ name: d.name, rank: d.rank });
      window.setTimeout(() => setDungeonCleared(null), 3800);
    }
  }

  function removeDungeon(id: string) {
    const snap = dungeons;
    setDungeons((prev) => prev.filter((x) => x.id !== id));
    deleteDungeon(id).catch(() => {
      setDungeons(snap);
      flash("Silinemedi");
    });
  }

  if (!authReady) {
    return (
      <main className="grid min-h-dvh place-items-center">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--border)] border-t-indigo-500" />
      </main>
    );
  }
  if (!session) return <Login />;

  // Bugün checklist'indeki rutinleri aşağıdaki alışkanlık listesinde tekrar gösterme
  const routineSet = new Set(routines.map((r) => r.name.trim().toLocaleLowerCase("tr")));
  const targets = computeTargets(profile);

  return (
    <main className="mx-auto flex h-dvh max-w-xl flex-col">
      {/* Üst başlık + sekmeler */}
      <header className="safe-top shrink-0 border-b border-[var(--border)] bg-[var(--background)] px-5 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Bitig</h1>
            <p className="text-sm capitalize text-[var(--muted)]">{dateStr}</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="rounded-full bg-slate-900 px-2.5 py-1 text-sm font-semibold text-cyan-300 ring-1 ring-cyan-400/40"
              title={`${score.points} XP · ${score.rank}-Rank · Seviye ${score.level}`}
            >
              ⬡ {score.rank} · Lv{score.level}
            </span>
            <button
              onClick={openInsight}
              className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition active:scale-95"
            >
              Özet
            </button>
          </div>
        </div>

        <div className="mt-3 flex gap-1 rounded-full bg-[var(--card)] p-1 ring-1 ring-[var(--border)]">
          {(
            [
              ["chat", "Sohbet"],
              ["today", "Bugün"],
              ["past", "Geçmiş"],
              ["analiz", "Analiz"],
            ] as const
          ).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-full py-1.5 text-sm font-medium transition ${
                tab === t ? "bg-indigo-500 text-white" : "text-[var(--muted)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* İçerik */}
      <div className="relative min-h-0 flex-1">
        {/* Chat hep mount kalır — sekme değişince devam eden yanıt kesilmez */}
        <div className={`h-full ${tab === "chat" ? "" : "hidden"}`}>
          <Chat
            userId={session.user.id}
            entries={entries}
            goals={goals}
            reminders={reminders}
            calorieTarget={targets?.target ?? null}
            onChanged={reload}
          />
        </div>

        {tab === "analiz" && (
          <div className="h-full overflow-y-auto px-5 pb-8">
            <Stats
              entries={entries}
              goals={goals}
              routines={routines}
              userId={session.user.id}
              onChanged={reload}
              onDeleteGoal={removeGoal}
            />
            <Dungeons
              dungeons={dungeons}
              entries={entries}
              goals={goals}
              onCreate={addDungeon}
              onToggleStep={toggleDungeonStep}
              onDelete={removeDungeon}
            />
          </div>
        )}

        {tab === "today" && (
          <div className="h-full overflow-y-auto px-5 pb-8">
            {targets ? (
              <CalorieRing entries={entries} targets={targets} />
            ) : (
              <button
                onClick={() => setSheetOpen(true)}
                className="mt-2 w-full rounded-2xl border border-dashed border-[var(--border)] p-3 text-left text-sm text-[var(--muted)]"
              >
                🍽️ Kalori takibi için profilini doldur (Özet) →
              </button>
            )}
            <Routines
              routines={routines}
              entries={entries}
              userId={session.user.id}
              onChanged={reload}
              onAdd={addRoutine}
              onDelete={removeRoutine}
            />
            {reminders.length > 0 && (
              <ReminderList reminders={reminders} onDelete={removeReminder} />
            )}
            {todays.length === 0 ? (
              routines.length > 0 ? null : <Empty tab="today" />
            ) : (
              <EntryList
                entries={todays}
                excludeHabitNames={routineSet}
                onToggle={toggleDone}
                onDelete={remove}
                onEdit={setEditing}
              />
            )}
          </div>
        )}

        {tab === "past" && (
          <div className="h-full overflow-y-auto px-5 pb-8">
            {past.length === 0 ? (
              <Empty tab="past" />
            ) : (
              <>
                <div className="sticky top-0 z-[2] -mx-5 flex items-center gap-1.5 overflow-x-auto border-b border-[var(--border)] bg-[var(--background)]/95 px-5 py-2 backdrop-blur">
                  <button
                    onClick={() => setPastFacet("all")}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${
                      pastFacet === "all"
                        ? "bg-indigo-500 text-white ring-indigo-500"
                        : "text-[var(--muted)] ring-[var(--border)]"
                    }`}
                  >
                    Tümü
                  </button>
                  {facets
                    .filter((f) => past.some((e) => matchFacet(e, f)))
                    .map((f) => (
                      <button
                        key={f.label}
                        onClick={() => setPastFacet(f.label)}
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${
                          pastFacet === f.label
                            ? "bg-indigo-500 text-white ring-indigo-500"
                            : "text-[var(--muted)] ring-[var(--border)]"
                        }`}
                      >
                        {f.emoji ? f.emoji + " " : ""}
                        {f.label}
                      </button>
                    ))}
                  <button
                    onClick={() => fetchFacets(true)}
                    title="Filtreleri yenile"
                    className="shrink-0 rounded-full px-2 py-1 text-xs text-[var(--muted)] ring-1 ring-[var(--border)]"
                  >
                    ↻
                  </button>
                </div>
                {(() => {
                  const sel = facets.find((f) => f.label === pastFacet);
                  return pastByDay
                    .map(
                      ([day, es]) =>
                        [day, sel ? es.filter((e) => matchFacet(e, sel)) : es] as [string, Entry[]]
                    )
                    .filter(([, es]) => es.length > 0)
                    .map(([day, dayEntries]) => (
                      <div key={day} className="mt-3">
                        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold capitalize">
                          {dayLabel(day)}
                          <span className="rounded-full bg-[var(--card)] px-2 text-xs font-normal text-[var(--muted)] ring-1 ring-[var(--border)]">
                            {dayEntries.length}
                          </span>
                        </h3>
                        <EntryList
                          entries={dayEntries}
                          onToggle={toggleDone}
                          onDelete={remove}
                          onEdit={setEditing}
                        />
                      </div>
                    ));
                })()}
              </>
            )}
          </div>
        )}

        {toast && (
          <div className="animate-pop pointer-events-none absolute inset-x-0 bottom-4 mx-auto w-fit rounded-full bg-stone-800 px-4 py-1.5 text-sm text-white shadow-lg dark:bg-stone-200 dark:text-stone-900">
            {toast}
          </div>
        )}
      </div>

      {/* Özet / hesap paneli */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setSheetOpen(false)}
        >
          <div
            className="animate-pop safe-bottom max-h-[80dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-[var(--card)] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[var(--border)]" />
            <h2 className="mb-1 text-xl font-bold">Haftalık özet</h2>
            <p className="mb-4 text-sm text-[var(--muted)]">Son kayıtlarından çıkarılan içgörüler</p>
            {insightBusy ? (
              <div className="flex items-center gap-3 py-8 text-[var(--muted)]">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border)] border-t-indigo-500" />
                Hazırlanıyor…
              </div>
            ) : (
              <div className="whitespace-pre-wrap leading-relaxed">{insight}</div>
            )}

            <div className="mt-6 border-t border-[var(--border)] pt-4">
              <p className="mb-2 text-sm font-medium">🍽️ Kalori hedefi (profil)</p>
              <ProfileForm profile={profile} onSave={saveProfile} />
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-[var(--border)] pt-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">🔔 Bildirimler</p>
                <p className="text-xs text-[var(--muted)]">
                  {!notificationsSupported()
                    ? "Bu tarayıcı/cihaz desteklemiyor"
                    : notifOn
                      ? "Bu cihazda açık"
                      : "Hatırlatmalar için bu cihazda aç"}
                </p>
              </div>
              <button
                onClick={toggleNotif}
                disabled={notifBusy || !notificationsSupported()}
                className="shrink-0 rounded-xl bg-indigo-500 px-3 py-2 text-sm font-medium text-white transition active:scale-95 disabled:opacity-40"
              >
                {notifBusy ? "…" : notifOn ? "Kapat" : "Aç"}
              </button>
            </div>

            <div className="mt-4 border-t border-[var(--border)] pt-4">
              <p className="mb-2 text-sm font-medium">🔑 Şifre belirle / değiştir</p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder="Yeni şifre (min 6)"
                  autoComplete="new-password"
                  className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-indigo-400"
                />
                <button
                  onClick={changePassword}
                  disabled={pw.length < 6}
                  className="shrink-0 rounded-xl bg-indigo-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
                >
                  Kaydet
                </button>
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Şifre koyunca telefonda e-posta + şifreyle (bağlantı beklemeden) girersin.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-4">
              <span className="truncate text-sm text-[var(--muted)]">{session.user.email}</span>
              <button
                onClick={signOut}
                className="shrink-0 rounded-xl px-3 py-2 text-sm font-medium text-red-500 ring-1 ring-[var(--border)]"
              >
                Çıkış yap
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kayıt düzenleme */}
      {editing && (
        <EntryEditor
          key={editing.id}
          entry={editing}
          onClose={() => setEditing(null)}
          onSave={saveEntryEdit}
        />
      )}

      {/* LEVEL UP bildirimi */}
      {levelUp != null && (
        <div className="pointer-events-none fixed inset-0 z-30 grid place-items-center">
          <div className="animate-pop rounded-2xl bg-slate-900 px-8 py-6 text-center text-cyan-50 shadow-[0_0_50px_-4px_rgba(34,211,238,0.75)] ring-1 ring-cyan-400/60">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-400/80">
              ⟪ Level Up ⟫
            </p>
            <p className="mt-2 text-4xl font-black text-cyan-300">Seviye {levelUp}</p>
            <p className="mt-1 text-sm text-cyan-300/70">
              {score.rank}-Rank · {score.points} XP
            </p>
          </div>
        </div>
      )}

      {/* Başarım açıldı bildirimi */}
      {newAch && (
        <div className="animate-pop pointer-events-none fixed inset-x-0 top-24 z-30 mx-auto w-fit rounded-2xl bg-slate-900 px-5 py-3 text-center text-cyan-50 shadow-[0_0_40px_-6px_rgba(34,211,238,0.7)] ring-1 ring-cyan-400/60">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-400/80">
            🏆 Başarım açıldı
          </p>
          <p className="mt-1 text-lg font-bold">
            {newAch.emoji} {newAch.name}
          </p>
        </div>
      )}

      {/* ZİNDAN TEMİZLENDİ bildirimi */}
      {dungeonCleared && (
        <div className="pointer-events-none fixed inset-0 z-30 grid place-items-center">
          <div className="animate-pop rounded-2xl bg-slate-900 px-8 py-6 text-center text-violet-50 shadow-[0_0_50px_-4px_rgba(167,139,250,0.75)] ring-1 ring-violet-400/60">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-violet-300/80">
              ⛩ Zindan Temizlendi
            </p>
            <p className="mt-2 text-2xl font-black text-violet-200">{dungeonCleared.name}</p>
            <p className="mt-1 text-sm text-violet-300/70">
              {dungeonCleared.rank}-Rank · Avcı yükseliyor
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

function matchFacet(e: Entry, f: Facet): boolean {
  if (f.kinds && f.kinds.includes(e.kind)) return true;
  if (f.keywords && f.keywords.length) {
    const t = entryText(e).toLocaleLowerCase("tr");
    return f.keywords.some((k) => t.includes(k));
  }
  return false;
}

function dayLabel(day: string): string {
  const t = new Date();
  const today = dayKey(t);
  t.setDate(t.getDate() - 1);
  const yest = dayKey(t);
  if (day === today) return "Bugün";
  if (day === yest) return "Dün";
  return new Date(day + "T00:00:00").toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function ReminderList({
  reminders,
  onDelete,
}: {
  reminders: Reminder[];
  onDelete: (id: string) => void;
}) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
        <span>⏰</span>
        Hatırlatmalar
        <span className="rounded-full bg-[var(--card)] px-2 text-[var(--muted)] ring-1 ring-[var(--border)]">
          {reminders.length}
        </span>
      </h2>
      <div className="space-y-2">
        {reminders.map((r) => (
          <div
            key={r.id}
            className="group flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm"
          >
            <span className="text-xl">⏰</span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{r.text}</p>
              <p className="text-sm text-[var(--muted)]">
                {new Date(r.remind_at).toLocaleString("tr-TR", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <button
              onClick={() => onDelete(r.id)}
              className="shrink-0 text-[var(--muted)] opacity-60 transition hover:opacity-100"
              aria-label="Sil"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function Empty({ tab }: { tab: "today" | "past" }) {
  return (
    <div className="mt-10 flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 text-5xl">{tab === "today" ? "🌱" : "🗂️"}</div>
      <p className="text-lg font-medium">
        {tab === "today" ? "Bugün için kayıt yok" : "Henüz geçmiş kayıt yok"}
      </p>
      <p className="mt-1 max-w-xs text-sm text-[var(--muted)]">
        {tab === "today"
          ? "Sohbet sekmesine geçip asistana gününü anlat — kayıtların burada belirsin."
          : "Geçmiş günlerdeki kayıtların burada görünecek."}
      </p>
    </div>
  );
}
