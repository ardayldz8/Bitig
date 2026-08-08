"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useCloudCollection } from "@/hooks/use-cloud-collection";
import {
  foodEntryToRow,
  rowToFoodEntry,
  rowToTargets,
  targetsToRow,
  type Row,
} from "@/lib/cloud/mappers";
import { dateKey, entriesForDate } from "@/lib/calorie/totals";
import { defaultTargets, type FoodEntry, type NutritionTargets } from "@/types/calorie";

/** Geriye dönük içe aktarımlar için: kimlik üretimi tek yerde tanımlı. */
export { createId } from "@/lib/ids";

export type CalorieTracker = {
  hydrated: boolean;
  error: string | null;
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
  const { client, userId } = useAuth();

  const collection = useCloudCollection<FoodEntry>({
    table: "food_entries",
    orderColumn: "consumed_at",
    toItem: rowToFoodEntry,
  });

  const { items: entries, mutate } = collection;

  const [targets, setTargets] = useState<NutritionTargets>(defaultTargets);
  const [targetsError, setTargetsError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState("");

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // "Bugün" yalnızca mount sonrası belirlenir: sunucuda üretilirse kullanıcının
  // değil sunucunun saat dilimine göre gün seçilir.
  useEffect(() => {
    setSelectedDate(dateKey(new Date()));
  }, []);

  // Hedefler kullanıcı başına tek satır; koleksiyon mantığına girmiyor.
  useEffect(() => {
    if (!client || !userId) return;

    void client
      .from("nutrition_targets")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!mountedRef.current) return;
        if (error) {
          setTargetsError(`Hedefler okunamadı: ${error.message}`);
          return;
        }
        // Kayıt yoksa varsayılan kullanılır; kullanıcı kaydedince satır oluşur.
        const parsed = data ? rowToTargets(data as Row) : null;
        if (parsed) setTargets(parsed);
        setTargetsError(null);
      });
  }, [client, userId]);

  const addEntries = useCallback(
    (incoming: FoodEntry[]) => {
      if (incoming.length === 0) return;
      mutate(
        (previous) => [...incoming, ...previous],
        (supabase, uid) =>
          supabase
            .from("food_entries")
            .insert(incoming.map((entry) => foodEntryToRow(entry, uid))),
        incoming.length > 1 ? "Kayıtlar eklenemedi" : "Kayıt eklenemedi",
        /*
         * Çevrimdışı kuyruk YALNIZCA tek kayıt eklerken devrede.
         *
         * Kuyruk satır satır çalışıyor; toplu ekleme (fotoğraf analizinden
         * gelen beş kalem gibi) bölünürse yarısı gidip yarısı kalabilir ve
         * kullanıcı hangisinin kaydolduğunu bilemez. Metroda öğün eklemek
         * tek kayıtlı senaryo — asıl hedef o.
         */
        incoming.length === 1
          ? {
              table: "food_entries",
              op: "insert" as const,
              payload: foodEntryToRow(incoming[0], ""),
            }
          : undefined,
      );
    },
    [mutate],
  );

  const updateEntry = useCallback(
    (id: string, patch: Partial<FoodEntry>) => {
      const stamp = new Date().toISOString();

      mutate(
        (previous) =>
          previous.map((entry) =>
            entry.id === id ? { ...entry, ...patch, id: entry.id, updatedAt: stamp } : entry,
          ),
        // Güncel liste mutate'ten gelir; closure'daki `entries` art arda gelen
        // düzenlemelerde bayat kalıyor.
        (supabase, uid, next) => {
          const updated = next.find((entry) => entry.id === id);
          if (!updated) return Promise.resolve({ error: null });
          return supabase
            .from("food_entries")
            .update(foodEntryToRow(updated, uid))
            .eq("id", id);
        },
        "Kayıt güncellenemedi",
      );
    },
    [mutate],
  );

  const removeEntry = useCallback(
    (id: string) => {
      mutate(
        (previous) => previous.filter((entry) => entry.id !== id),
        (supabase) => supabase.from("food_entries").delete().eq("id", id),
        "Kayıt silinemedi",
      );
    },
    [mutate],
  );

  const saveTargets = useCallback(
    (next: NutritionTargets) => {
      const previous = targets;
      setTargets(next);
      setTargetsError(null);

      if (!client || !userId) {
        setTargetsError("Oturum bulunamadı, hedefler kaydedilemedi.");
        setTargets(previous);
        return;
      }

      void client
        .from("nutrition_targets")
        .upsert(targetsToRow(next, userId), { onConflict: "user_id" })
        .then(({ error }) => {
          if (!mountedRef.current || !error) return;
          setTargets(previous);
          setTargetsError(`Hedefler kaydedilemedi: ${error.message}`);
        });
    },
    [client, userId, targets],
  );

  const dayEntries = useMemo(
    () => (selectedDate ? entriesForDate(entries, selectedDate) : []),
    [entries, selectedDate],
  );

  return {
    hydrated: collection.hydrated,
    error: collection.error ?? targetsError,
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
