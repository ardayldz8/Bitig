"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  readEntries,
  readTargets,
  writeEntries,
  writeTargets,
} from "@/lib/calorie/storage";
import { dateKey, entriesForDate } from "@/lib/calorie/totals";
import { defaultTargets, type FoodEntry, type NutritionTargets } from "@/types/calorie";

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export type CalorieTracker = {
  hydrated: boolean;
  entries: FoodEntry[];
  dayEntries: FoodEntry[];
  targets: NutritionTargets;
  selectedDate: string;
  setSelectedDate: (day: string) => void;
  addEntries: (entries: FoodEntry[]) => void;
  updateEntry: (id: string, patch: Partial<FoodEntry>) => void;
  removeEntry: (id: string) => void;
  saveTargets: (targets: NutritionTargets) => void;
};

export function useCalorieTracker(): CalorieTracker {
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [targets, setTargets] = useState<NutritionTargets>(defaultTargets);
  const [selectedDate, setSelectedDate] = useState("");
  const [hydrated, setHydrated] = useState(false);

  // localStorage ve "bugün" yalnızca mount sonrası okunur → hydration uyuşmazlığı olmaz
  useEffect(() => {
    setEntries(readEntries());
    setTargets(readTargets());
    setSelectedDate(dateKey(new Date()));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeEntries(entries);
  }, [entries, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    writeTargets(targets);
  }, [targets, hydrated]);

  const addEntries = useCallback((incoming: FoodEntry[]) => {
    if (incoming.length === 0) return;
    setEntries((prev) => [...incoming, ...prev]);
  }, []);

  const updateEntry = useCallback((id: string, patch: Partial<FoodEntry>) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? { ...entry, ...patch, id: entry.id, updatedAt: new Date().toISOString() }
          : entry,
      ),
    );
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const saveTargets = useCallback((next: NutritionTargets) => {
    setTargets(next);
  }, []);

  const dayEntries = useMemo(
    () => (selectedDate ? entriesForDate(entries, selectedDate) : []),
    [entries, selectedDate],
  );

  return {
    hydrated,
    entries,
    dayEntries,
    targets,
    selectedDate,
    setSelectedDate,
    addEntries,
    updateEntry,
    removeEntry,
    saveTargets,
  };
}
