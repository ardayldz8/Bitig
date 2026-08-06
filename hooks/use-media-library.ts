"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createInitialEntries,
  createMediaId,
  readMediaEntries,
  writeMediaEntries,
} from "@/lib/media/storage";
import type { MediaEntry } from "@/types/media";

export type MediaDraft = Omit<MediaEntry, "id" | "createdAt" | "updatedAt">;

export type MediaLibrary = {
  hydrated: boolean;
  entries: MediaEntry[];
  addEntry: (draft: MediaDraft) => void;
  updateEntry: (id: string, draft: MediaDraft) => void;
  patchEntry: (id: string, patch: Partial<MediaEntry>) => void;
  removeEntry: (id: string) => void;
};

export function useMediaLibrary(): MediaLibrary {
  const [entries, setEntries] = useState<MediaEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // localStorage ve örnek veri yalnızca mount sonrası okunur.
  // (Örnek veride new Date() var; sunucuda üretilseydi hydration uyuşmazlığı olurdu.)
  useEffect(() => {
    const stored = readMediaEntries();
    setEntries(stored ?? createInitialEntries());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeMediaEntries(entries);
  }, [entries, hydrated]);

  const addEntry = useCallback((draft: MediaDraft) => {
    setEntries((prev) => {
      const now = new Date().toISOString();
      const entry: MediaEntry = {
        ...draft,
        id: createMediaId(draft.title, prev),
        createdAt: now,
        updatedAt: now,
      };
      return [entry, ...prev];
    });
  }, []);

  const updateEntry = useCallback((id: string, draft: MediaDraft) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? { ...entry, ...draft, updatedAt: new Date().toISOString() }
          : entry,
      ),
    );
  }, []);

  const patchEntry = useCallback((id: string, patch: Partial<MediaEntry>) => {
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

  return { hydrated, entries, addEntry, updateEntry, patchEntry, removeEntry };
}
