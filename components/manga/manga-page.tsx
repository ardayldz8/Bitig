"use client";

import { useEffect, useMemo, useState } from "react";
import { Library, Plus } from "lucide-react";
import MangaCard from "@/components/manga/manga-card";
import MangaDeleteDialog from "@/components/manga/manga-delete-dialog";
import MangaFormModal from "@/components/manga/manga-form-modal";
import MangaToolbar from "@/components/manga/manga-toolbar";
import { useMangaLibrary } from "@/hooks/use-manga-library";
import { useActionParam } from "@/hooks/use-action-param";
import { searchMangas, sortMangas } from "@/lib/manga";
import type { Manga, MangaDraft, SortKey } from "@/types/manga";

type DialogState =
  | { type: "none" }
  | { type: "form"; manga: Manga | null }
  | { type: "delete"; manga: Manga };

export default function MangaPage() {
  const { mangas, hydrated, addManga, updateManga, removeManga, changeChapter } =
    useMangaLibrary();

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [dialog, setDialog] = useState<DialogState>({ type: "none" });

  // Ana sayfadaki "Manga ekle" hızlı işleminden gelindiğinde formu aç
  const addAction = useActionParam("add");
  useEffect(() => {
    if (addAction.triggered) setDialog({ type: "form", manga: null });
  }, [addAction.triggered]);

  const visibleMangas = useMemo(
    () => sortMangas(searchMangas(mangas, query), sort),
    [mangas, query, sort],
  );

  const closeDialog = () => {
    setDialog({ type: "none" });
    addAction.clear();
  };

  function handleFormSubmit(draft: MangaDraft) {
    if (dialog.type !== "form") return;

    if (dialog.manga) {
      updateManga(dialog.manga.id, draft);
    } else {
      addManga(draft);
    }
    closeDialog();
  }

  function handleDeleteConfirm() {
    if (dialog.type !== "delete") return;
    removeManga(dialog.manga.id);
    closeDialog();
  }

  const isSearching = query.trim().length > 0;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[1100px] px-4 pt-8 pb-28 sm:px-6 sm:pt-10">
      <header>
        {/* Marka alanı üstteki gezinme çubuğunda; burada tekrarlanmaz */}
        <div className="flex justify-end">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-sm text-ink-soft shadow-card">
            <Library size={16} aria-hidden="true" className="text-brand" />
            Toplam <strong className="font-semibold text-ink">{mangas.length}</strong>{" "}
            manga
          </span>
        </div>

        <h1 className="mt-5 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Manga Takibi
        </h1>
        <p className="mt-2 text-ink-soft">
          Okuduklarını takip et, bölümünü unutma.
        </p>
      </header>

      <div className="mt-7">
        <MangaToolbar
          query={query}
          onQueryChange={setQuery}
          sort={sort}
          onSortChange={setSort}
        />
      </div>

      <main aria-busy={!hydrated} className="mt-6">
        {visibleMangas.length === 0 ? (
          <EmptyState
            isSearching={isSearching}
            onAdd={() => setDialog({ type: "form", manga: null })}
          />
        ) : (
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {visibleMangas.map((manga) => (
              <li key={manga.id}>
                <MangaCard
                  manga={manga}
                  onEdit={(target) => setDialog({ type: "form", manga: target })}
                  onDelete={(target) => setDialog({ type: "delete", manga: target })}
                  onChangeChapter={changeChapter}
                />
              </li>
            ))}
          </ul>
        )}
      </main>

      <button
        type="button"
        onClick={() => setDialog({ type: "form", manga: null })}
        className="fixed right-4 bottom-4 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-3.5 font-medium text-white shadow-card transition-colors hover:bg-brand-strong sm:right-6 sm:bottom-6"
      >
        <Plus size={18} aria-hidden="true" />
        Yeni manga ekle
      </button>

      {dialog.type === "form" && (
        <MangaFormModal
          manga={dialog.manga}
          existingMangas={mangas}
          onSubmit={handleFormSubmit}
          onClose={closeDialog}
        />
      )}

      {dialog.type === "delete" && (
        <MangaDeleteDialog
          manga={dialog.manga}
          onConfirm={handleDeleteConfirm}
          onCancel={closeDialog}
        />
      )}
    </div>
  );
}

function EmptyState({
  isSearching,
  onAdd,
}: {
  isSearching: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="rounded-card border border-dashed border-line-strong bg-surface p-10 text-center">
      <p className="font-medium text-ink">
        {isSearching ? "Aramanla eşleşen manga yok" : "Henüz manga eklemedin"}
      </p>
      <p className="mt-1.5 text-sm text-ink-soft">
        {isSearching
          ? "Farklı bir arama dene ya da yeni bir manga ekle."
          : "İlk mangayı ekleyerek takibe başla."}
      </p>
      {!isSearching && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 font-medium text-white transition-colors hover:bg-brand-strong"
        >
          <Plus size={18} aria-hidden="true" />
          Yeni manga ekle
        </button>
      )}
    </div>
  );
}
