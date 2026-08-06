"use client";

import { useState } from "react";
import { BookOpen, Minus, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { MAX_RATING, coverLetter, formatNumber } from "@/lib/manga";
import type { Manga } from "@/types/manga";

/**
 * Kapak: adres varsa görsel, yoksa (ya da görsel yüklenemezse) harf yer tutucusu.
 * next/image yerine düz <img> — keyfi harici alan adları için domain
 * yapılandırması gerektirmez.
 */
function Cover({ manga }: { manga: Manga }) {
  const [failed, setFailed] = useState(false);
  const showImage = manga.coverUrl !== null && !failed;

  return (
    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-line-strong bg-brand-soft">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={manga.coverUrl ?? ""}
          alt={`${manga.name} kapağı`}
          onError={() => setFailed(true)}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="grid h-full w-full place-items-center text-2xl font-bold text-brand"
        >
          {coverLetter(manga.name)}
        </div>
      )}
    </div>
  );
}

type MangaCardProps = {
  manga: Manga;
  onEdit: (manga: Manga) => void;
  onDelete: (manga: Manga) => void;
  onChangeChapter: (id: string, delta: number) => void;
};

const iconButtonClass =
  "grid h-9 w-9 place-items-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-40";

export default function MangaCard({
  manga,
  onEdit,
  onDelete,
  onChangeChapter,
}: MangaCardProps) {
  const isCompleted = manga.status === "completed";

  return (
    <article className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <div className="flex items-start gap-4">
        <Cover manga={manga} />

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-ink sm:text-lg">
            {manga.name}
          </h3>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
              <Star size={15} aria-hidden="true" className="text-brand" />
              Puan: {formatNumber(manga.rating)}/{MAX_RATING}
            </span>

            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                isCompleted ? "bg-ok-soft text-ok" : "bg-brand-soft text-brand-strong"
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${
                  isCompleted ? "bg-ok" : "bg-brand"
                }`}
              />
              {isCompleted ? "Tamamlandı" : "Devam ediyor"}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => onEdit(manga)}
            aria-label={`${manga.name} kaydını düzenle`}
            className={`${iconButtonClass} border-line text-ink-soft hover:border-brand hover:bg-brand-soft hover:text-brand`}
          >
            <Pencil size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(manga)}
            aria-label={`${manga.name} kaydını sil`}
            className={`${iconButtonClass} border-line text-ink-soft hover:border-danger hover:bg-danger-soft hover:text-danger`}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-line pt-4">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
            <BookOpen size={14} aria-hidden="true" />
            Kaldığım bölüm
          </p>
          <p className="text-2xl font-bold text-brand tabular-nums">
            {formatNumber(manga.currentChapter)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onChangeChapter(manga.id, -1)}
            disabled={manga.currentChapter <= 0}
            aria-label={`${manga.name} bölümünü azalt`}
            className={`${iconButtonClass} border-line text-ink hover:border-brand hover:bg-brand-soft hover:text-brand`}
          >
            <Minus size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onChangeChapter(manga.id, 1)}
            aria-label={`${manga.name} bölümünü artır`}
            className={`${iconButtonClass} border-brand bg-brand text-white hover:bg-brand-strong`}
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
