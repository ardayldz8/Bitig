"use client";

import { useCallback, useEffect, useState } from "react";
import { createMangaId, initialMangas } from "@/lib/manga";
import { readStoredMangas, writeStoredMangas } from "@/lib/storage";
import type { Manga, MangaDraft } from "@/types/manga";

export type MangaLibrary = {
  mangas: Manga[];
  /** localStorage okunana kadar false — kaydedilmiş veriyi ezmemek için kullanılır. */
  hydrated: boolean;
  addManga: (draft: MangaDraft) => void;
  updateManga: (id: string, draft: MangaDraft) => void;
  removeManga: (id: string) => void;
  changeChapter: (id: string, delta: number) => void;
};

export function useMangaLibrary(): MangaLibrary {
  // Sunucu ve ilk istemci render'ı aynı veriyle çalışır → hydration uyuşmazlığı olmaz.
  const [mangas, setMangas] = useState<Manga[]>(initialMangas);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStoredMangas();
    if (stored) setMangas(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeStoredMangas(mangas);
  }, [mangas, hydrated]);

  const addManga = useCallback((draft: MangaDraft) => {
    setMangas((prev) => [{ ...draft, id: createMangaId(draft.name, prev) }, ...prev]);
  }, []);

  const updateManga = useCallback((id: string, draft: MangaDraft) => {
    setMangas((prev) =>
      prev.map((manga) => (manga.id === id ? { ...manga, ...draft } : manga)),
    );
  }, []);

  const removeManga = useCallback((id: string) => {
    setMangas((prev) => prev.filter((manga) => manga.id !== id));
  }, []);

  const changeChapter = useCallback((id: string, delta: number) => {
    setMangas((prev) =>
      prev.map((manga) =>
        manga.id === id
          ? { ...manga, currentChapter: Math.max(0, manga.currentChapter + delta) }
          : manga,
      ),
    );
  }, []);

  return { mangas, hydrated, addManga, updateManga, removeManga, changeChapter };
}
