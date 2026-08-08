"use client";

import { useCallback } from "react";
import { useCloudCollection } from "@/hooks/use-cloud-collection";
import { mangaToRow, rowToManga } from "@/lib/cloud/mappers";
import { createId } from "@/lib/ids";
import type { Manga, MangaDraft } from "@/types/manga";

export type MangaLibrary = {
  mangas: Manga[];
  /** İlk yükleme bitene kadar false. */
  hydrated: boolean;
  error: string | null;
  addManga: (draft: MangaDraft) => void;
  linkCatalog: (
    id: string,
    mangadexId: string,
    latestChapter: number | null,
    coverUrl: string | null,
  ) => void;
  updateManga: (id: string, draft: MangaDraft) => void;
  removeManga: (id: string) => void;
  changeChapter: (id: string, delta: number) => void;
};

export function useMangaLibrary(): MangaLibrary {
  const collection = useCloudCollection<Manga>({
    table: "mangas",
    orderColumn: "created_at",
    toItem: rowToManga,
  });

  const { mutate } = collection;

  const addManga = useCallback(
    (draft: MangaDraft) => {
      const manga: Manga = { ...draft, id: createId(), mangadexId: null, latestChapter: null };
      mutate(
        (previous) => [manga, ...previous],
        (client, userId) => client.from("mangas").insert(mangaToRow(manga, userId)),
        "Manga eklenemedi",
      );
    },
    [mutate],
  );

  const updateManga = useCallback(
    (id: string, draft: MangaDraft) => {
      mutate(
        (previous) =>
          previous.map((manga) => (manga.id === id ? { ...manga, ...draft } : manga)),
        /*
         * Yalnızca formdaki alanlar yazılıyor, TÜM satır değil.
         *
         * mangaToRow ile tam satır yazılsaydı her düzenlemede mangadex_id ve
         * latest_chapter null'a dönerdi — kullanıcı puanını değiştirdiği anda
         * kurduğu katalog bağı sessizce kopardı.
         */
        (client, userId) =>
          client
            .from("mangas")
            .update({
              user_id: userId,
              name: draft.name,
              current_chapter: draft.currentChapter,
              rating: draft.rating,
              status: draft.status,
              cover_url: draft.coverUrl,
              updated_at: new Date().toISOString(),
            })
            .eq("id", id),
        "Manga güncellenemedi",
      );
    },
    [mutate],
  );

  /** Mangayı MangaDex kaydına bağlar; kapak yoksa katalogdakini kullanır. */
  const linkCatalog = useCallback(
    (id: string, mangadexId: string, latestChapter: number | null, coverUrl: string | null) => {
      mutate(
        (previous) =>
          previous.map((manga) =>
            manga.id === id
              ? {
                  ...manga,
                  mangadexId,
                  latestChapter,
                  // Kullanıcının kendi kapağı varsa ezilmiyor
                  coverUrl: manga.coverUrl ?? coverUrl,
                }
              : manga,
          ),
        (client, _userId, next) => {
          const manga = next.find((item) => item.id === id);
          if (!manga) return Promise.resolve({ error: null });
          return client
            .from("mangas")
            .update({
              mangadex_id: mangadexId,
              latest_chapter: latestChapter,
              latest_checked_at: new Date().toISOString(),
              cover_url: manga.coverUrl,
            })
            .eq("id", id);
        },
        "Katalog bağlantısı kaydedilemedi",
      );
    },
    [mutate],
  );

  const removeManga = useCallback(
    (id: string) => {
      mutate(
        (previous) => previous.filter((manga) => manga.id !== id),
        (client) => client.from("mangas").delete().eq("id", id),
        "Manga silinemedi",
      );
    },
    [mutate],
  );

  const changeChapter = useCallback(
    (id: string, delta: number) => {
      mutate(
        (previous) =>
          previous.map((manga) =>
            manga.id === id
              ? { ...manga, currentChapter: Math.max(0, manga.currentChapter + delta) }
              : manga,
          ),
        // Yazılacak değer, mutate'in verdiği güncel listeden okunur. Hook'un
        // kendi `items`'ından okunsaydı hızlı ardışık tıklamalarda ikinci
        // yazma birincinin sonucunu görmez ve aynı değeri tekrar gönderirdi.
        (client, userId, next) => {
          const updated = next.find((manga) => manga.id === id);
          if (!updated) return Promise.resolve({ error: null });
          return client.from("mangas").update(mangaToRow(updated, userId)).eq("id", id);
        },
        "Bölüm güncellenemedi",
      );
    },
    [mutate],
  );

  return {
    mangas: collection.items,
    hydrated: collection.hydrated,
    error: collection.error,
    addManga,
    linkCatalog,
    updateManga,
    removeManga,
    changeChapter,
  };
}
