"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import Modal from "@/components/ui/modal";
import MediaEmptyState from "@/components/media/media-empty-state";
import MediaFilterTabs from "@/components/media/media-filter-tabs";
import MediaFormModal from "@/components/media/media-form-modal";
import MediaHeader from "@/components/media/media-header";
import MediaList from "@/components/media/media-list";
import MediaToolbar from "@/components/media/media-toolbar";
import { useMediaLibrary, type MediaDraft } from "@/hooks/use-media-library";
import {
  estimatedEpisodesPerSeason,
  positionLabel,
  shouldSuggestNextSeason,
} from "@/lib/media/progress";
import { filterEntries, searchEntries, sortEntries } from "@/lib/media/sorting";
import type {
  MediaEntry,
  MediaSortKey,
  StatusFilter,
  TypeFilter,
} from "@/types/media";

type DialogState =
  | { type: "none" }
  | { type: "form"; entry: MediaEntry | null }
  | { type: "delete"; entry: MediaEntry }
  /** `+` sonrası: tahmini sezon sonu geçildi, sonraki sezona geçilsin mi? */
  | { type: "next-season"; entry: MediaEntry; nextSeason: number; nextEpisode: number }
  /** `−` sonrası: 1. bölümdeyiz, önceki sezona dönülsün mü? */
  | { type: "prev-season"; entry: MediaEntry; prevSeason: number; targetEpisode: number };

export default function MediaPage() {
  const library = useMediaLibrary();
  const confirmId = useId();

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<MediaSortKey>("recent");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [dialog, setDialog] = useState<DialogState>({ type: "none" });
  const [announcement, setAnnouncement] = useState("");

  const visibleEntries = useMemo(() => {
    const filtered = filterEntries(library.entries, statusFilter, typeFilter);
    return sortEntries(searchEntries(filtered, query), sort);
  }, [library.entries, statusFilter, typeFilter, query, sort]);

  const hasFilters =
    query.trim().length > 0 || statusFilter !== "all" || typeFilter !== "all";

  const closeDialog = () => setDialog({ type: "none" });

  const clearFilters = useCallback(() => {
    setQuery("");
    setStatusFilter("all");
    setTypeFilter("all");
  }, []);

  const announce = useCallback((entry: MediaEntry, season: number, episode: number) => {
    setAnnouncement(`${entry.title}: ${season}. sezon ${episode}. bölüm`);
  }, []);

  /** Bölüm artır / azalt. Sezon geçişleri kullanıcı onayı ister. */
  const handleEpisodeChange = useCallback(
    (entry: MediaEntry, delta: number) => {
      if (entry.mediaType !== "series") return;

      const season = entry.currentSeason ?? 1;
      const episode = entry.currentEpisode ?? 1;

      if (delta > 0) {
        const nextEpisode = episode + 1;

        // Tek sezonluk dizide toplam bölüm bilinir → sınırı aşma
        if (
          entry.totalSeasons === 1 &&
          entry.totalEpisodes !== null &&
          nextEpisode > entry.totalEpisodes
        ) {
          setAnnouncement(`${entry.title} son bölümde.`);
          return;
        }

        // Tahmini sezon sonu geçildi ve sonraki sezon var → ÖNER (otomatik yapma)
        if (shouldSuggestNextSeason(entry, nextEpisode)) {
          setDialog({
            type: "next-season",
            entry,
            nextSeason: season + 1,
            nextEpisode,
          });
          return;
        }

        library.patchEntry(entry.id, { currentEpisode: nextEpisode });
        announce(entry, season, nextEpisode);
        return;
      }

      if (episode > 1) {
        library.patchEntry(entry.id, { currentEpisode: episode - 1 });
        announce(entry, season, episode - 1);
        return;
      }

      // 1. bölümdeyiz: önceki sezona dönmek onay ister
      if (season > 1) {
        const estimate = estimatedEpisodesPerSeason(entry);
        setDialog({
          type: "prev-season",
          entry,
          prevSeason: season - 1,
          targetEpisode: estimate && estimate > 0 ? estimate : 1,
        });
      }
    },
    [announce, library],
  );

  const handleSave = useCallback(
    (draft: MediaDraft) => {
      if (dialog.type !== "form") return;
      if (dialog.entry) library.updateEntry(dialog.entry.id, draft);
      else library.addEntry(draft);
      closeDialog();
    },
    [dialog, library],
  );

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[1100px] px-4 pt-8 pb-28 sm:px-6 sm:pt-10">
      <MediaHeader
        total={library.entries.length}
        onAdd={() => setDialog({ type: "form", entry: null })}
      />

      <div className="mt-7 space-y-4">
        <MediaToolbar
          query={query}
          onQueryChange={setQuery}
          sort={sort}
          onSortChange={setSort}
        />
        <MediaFilterTabs
          status={statusFilter}
          onStatusChange={setStatusFilter}
          type={typeFilter}
          onTypeChange={setTypeFilter}
        />
      </div>

      {/* Bölüm değişimi gibi dinamik güncellemeler ekran okuyucuya bildirilir */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <main className="mt-6" aria-busy={!library.hydrated}>
        {!library.hydrated ? (
          // Veriler mount sonrası yüklenir → hydration uyuşmazlığı olmaz
          <div className="space-y-4">
            <p className="sr-only">Kayıtlar yükleniyor</p>
            <div className="h-36 rounded-card border border-line bg-surface" />
            <div className="h-36 rounded-card border border-line bg-surface" />
          </div>
        ) : visibleEntries.length === 0 ? (
          <MediaEmptyState
            filtered={library.entries.length > 0 && hasFilters}
            onAdd={() => setDialog({ type: "form", entry: null })}
            onClearFilters={clearFilters}
          />
        ) : (
          <>
            <p className="mb-3 text-sm text-ink-soft">
              {visibleEntries.length} yapım gösteriliyor
            </p>
            <MediaList
              entries={visibleEntries}
              onEdit={(entry) => setDialog({ type: "form", entry })}
              onDelete={(entry) => setDialog({ type: "delete", entry })}
              onEpisodeChange={handleEpisodeChange}
            />
          </>
        )}
      </main>

      <button
        type="button"
        onClick={() => setDialog({ type: "form", entry: null })}
        aria-label="Yeni dizi veya film ekle"
        className="fixed right-4 bottom-4 grid h-14 w-14 place-items-center rounded-full bg-brand text-white shadow-card transition-colors hover:bg-brand-strong sm:right-6 sm:bottom-6"
      >
        <Plus size={24} aria-hidden="true" />
      </button>

      {dialog.type === "form" && (
        <MediaFormModal
          entry={dialog.entry}
          entries={library.entries}
          onSave={handleSave}
          onClose={closeDialog}
        />
      )}

      {dialog.type === "delete" && (
        <Modal title="Kaydı sil" titleId={confirmId} onClose={closeDialog}>
          <p className="text-ink-soft">
            <span className="font-medium text-ink">“{dialog.entry.title}”</span> kaydını
            silmek istediğine emin misin? Bu işlem geri alınamaz.
          </p>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeDialog}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line px-4 py-2.5 font-medium text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={() => {
                library.removeEntry(dialog.entry.id);
                closeDialog();
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-danger px-5 py-2.5 font-medium text-white transition-colors hover:brightness-95"
            >
              Sil
            </button>
          </div>
        </Modal>
      )}

      {dialog.type === "next-season" && (
        <Modal title="Sonraki sezona geç" titleId={confirmId} onClose={closeDialog}>
          <p className="text-ink-soft">
            <span className="font-medium text-ink">{dialog.entry.title}</span> için{" "}
            {dialog.entry.currentSeason}. sezonun sonuna gelmiş olabilirsin.{" "}
            <strong className="text-ink">{dialog.nextSeason}. sezon 1. bölüme</strong>{" "}
            geçmek ister misin?
          </p>
          <p className="mt-2 text-xs text-ink-soft">
            Sezon başına bölüm sayısı kesin bilinmediği için bu yalnızca bir tahmindir —
            dilersen bu sezonda kalıp bölümü artırabilirsin.
          </p>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeDialog}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line px-4 py-2.5 font-medium text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={() => {
                library.patchEntry(dialog.entry.id, {
                  currentEpisode: dialog.nextEpisode,
                });
                announce(dialog.entry, dialog.entry.currentSeason ?? 1, dialog.nextEpisode);
                closeDialog();
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line px-4 py-2.5 font-medium text-ink transition-colors hover:border-brand hover:text-brand"
            >
              Bu sezonda kal ({dialog.nextEpisode}. bölüm)
            </button>
            <button
              type="button"
              onClick={() => {
                library.patchEntry(dialog.entry.id, {
                  currentSeason: dialog.nextSeason,
                  currentEpisode: 1,
                });
                announce(dialog.entry, dialog.nextSeason, 1);
                closeDialog();
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 py-2.5 font-medium text-white transition-colors hover:bg-brand-strong"
            >
              {dialog.nextSeason}. sezona geç
            </button>
          </div>
        </Modal>
      )}

      {dialog.type === "prev-season" && (
        <Modal title="Önceki sezona dön" titleId={confirmId} onClose={closeDialog}>
          <p className="text-ink-soft">
            <span className="font-medium text-ink">{dialog.entry.title}</span> için
            sezonun ilk bölümündesin.{" "}
            <strong className="text-ink">
              {dialog.prevSeason}. sezon {dialog.targetEpisode}. bölüme
            </strong>{" "}
            dönmek ister misin?
          </p>
          {estimatedEpisodesPerSeason(dialog.entry) !== null && (
            <p className="mt-2 text-xs text-ink-soft">
              Bölüm numarası sezon başına ortalamadan tahmin edildi; dönüşten sonra
              düzenleyebilirsin.
            </p>
          )}
          <p className="mt-2 text-xs text-ink-soft">
            Şu anki konum: {positionLabel(dialog.entry)}
          </p>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeDialog}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line px-4 py-2.5 font-medium text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={() => {
                library.patchEntry(dialog.entry.id, {
                  currentSeason: dialog.prevSeason,
                  currentEpisode: dialog.targetEpisode,
                });
                announce(dialog.entry, dialog.prevSeason, dialog.targetEpisode);
                closeDialog();
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 py-2.5 font-medium text-white transition-colors hover:bg-brand-strong"
            >
              Önceki sezona dön
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
