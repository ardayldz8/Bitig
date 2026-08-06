"use client";

import { useCallback } from "react";
import { useCloudCollection } from "@/hooks/use-cloud-collection";
import { mediaEntryToRow, rowToMediaEntry } from "@/lib/cloud/mappers";
import { createId } from "@/lib/ids";
import type { MediaEntry } from "@/types/media";

export type MediaDraft = Omit<MediaEntry, "id" | "createdAt" | "updatedAt">;

export type MediaLibrary = {
  hydrated: boolean;
  error: string | null;
  entries: MediaEntry[];
  addEntry: (draft: MediaDraft) => void;
  updateEntry: (id: string, draft: MediaDraft) => void;
  patchEntry: (id: string, patch: Partial<MediaEntry>) => void;
  removeEntry: (id: string) => void;
};

export function useMediaLibrary(): MediaLibrary {
  const collection = useCloudCollection<MediaEntry>({
    table: "media_entries",
    orderColumn: "created_at",
    toItem: rowToMediaEntry,
  });

  const { items, mutate } = collection;

  const addEntry = useCallback(
    (draft: MediaDraft) => {
      const now = new Date().toISOString();
      const entry: MediaEntry = { ...draft, id: createId(), createdAt: now, updatedAt: now };

      mutate(
        (previous) => [entry, ...previous],
        (client, userId) =>
          client.from("media_entries").insert(mediaEntryToRow(entry, userId)),
        "Kayıt eklenemedi",
      );
    },
    [mutate],
  );

  /** Tam kayıt güncellemesi (form) ve kısmi güncelleme (bölüm sayacı) aynı yolu kullanır. */
  const applyPatch = useCallback(
    (id: string, patch: Partial<MediaEntry>, failMessage: string) => {
      // Zaman damgası dışarıda üretilir: optimistic geri çağrımı saf kalsın.
      const stamp = new Date().toISOString();

      mutate(
        (previous) =>
          previous.map((entry) =>
            entry.id === id
              ? {
                  ...entry,
                  ...patch,
                  id: entry.id,
                  createdAt: entry.createdAt,
                  updatedAt: stamp,
                }
              : entry,
          ),
        // Güncel liste mutate'ten gelir; hook'un `items`'ı art arda gelen
        // değişikliklerde bayat kalıyor.
        (client, userId, next) => {
          const updated = next.find((entry) => entry.id === id);
          if (!updated) return Promise.resolve({ error: null });
          return client
            .from("media_entries")
            .update(mediaEntryToRow(updated, userId))
            .eq("id", id);
        },
        failMessage,
      );
    },
    [mutate],
  );

  const updateEntry = useCallback(
    (id: string, draft: MediaDraft) => applyPatch(id, draft, "Kayıt güncellenemedi"),
    [applyPatch],
  );

  const patchEntry = useCallback(
    (id: string, patch: Partial<MediaEntry>) =>
      applyPatch(id, patch, "Kayıt güncellenemedi"),
    [applyPatch],
  );

  const removeEntry = useCallback(
    (id: string) => {
      mutate(
        (previous) => previous.filter((entry) => entry.id !== id),
        (client) => client.from("media_entries").delete().eq("id", id),
        "Kayıt silinemedi",
      );
    },
    [mutate],
  );

  return {
    hydrated: collection.hydrated,
    error: collection.error,
    entries: items,
    addEntry,
    updateEntry,
    patchEntry,
    removeEntry,
  };
}
