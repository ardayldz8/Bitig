"use client";

import { useState } from "react";
import {
  Check,
  Clapperboard,
  Eye,
  Minus,
  Pencil,
  Plus,
  Star,
  Trash2,
  Tv,
  CalendarClock,
} from "lucide-react";
import { computeProgress } from "@/lib/media/progress";
import { formatRating } from "@/lib/media/sorting";
import {
  MEDIA_TYPE_LABELS,
  STATUS_LABELS,
  type MediaEntry,
  type WatchStatus,
} from "@/types/media";

type MediaCardProps = {
  entry: MediaEntry;
  onEdit: (entry: MediaEntry) => void;
  onDelete: (entry: MediaEntry) => void;
  onEpisodeChange: (entry: MediaEntry, delta: number) => void;
};

/** Durum: renk + metin + ikon (yalnızca renge dayanmaz). */
const STATUS_STYLE: Record<
  WatchStatus,
  { chip: string; dot: string; Icon: typeof Eye }
> = {
  watching: { chip: "bg-brand-soft text-brand-strong", dot: "bg-brand", Icon: Eye },
  completed: { chip: "bg-ok-soft text-ok", dot: "bg-ok", Icon: Check },
  planned: {
    chip: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
    Icon: CalendarClock,
  },
};

const iconButtonClass =
  "grid h-11 w-11 shrink-0 place-items-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-40";

export default function MediaCard({
  entry,
  onEdit,
  onDelete,
  onEpisodeChange,
}: MediaCardProps) {
  const isSeries = entry.mediaType === "series";
  const progress = computeProgress(entry);
  const status = STATUS_STYLE[entry.status];
  const StatusIcon = status.Icon;

  return (
    <article className="flex gap-4 rounded-card border border-line bg-surface p-4 shadow-card">
      <Poster entry={entry} />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-ink sm:text-lg">
              {entry.title}
            </h3>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-soft">
              {isSeries ? (
                <Tv size={14} aria-hidden="true" />
              ) : (
                <Clapperboard size={14} aria-hidden="true" />
              )}
              {MEDIA_TYPE_LABELS[entry.mediaType]}
              {entry.releaseYear !== null && <> · {entry.releaseYear}</>}
            </p>
          </div>

          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.chip}`}
          >
            <StatusIcon size={13} aria-hidden="true" />
            {STATUS_LABELS[entry.status]}
          </span>
        </div>

        {/* Konum / puan */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
          {isSeries && progress.kind === "position" && (
            <span className="text-ink">{progress.label}</span>
          )}
          {entry.rating !== null ? (
            <span className="inline-flex items-center gap-1.5 text-ink-soft">
              <Star size={14} aria-hidden="true" className="text-brand" />
              {formatRating(entry.rating)}/10
            </span>
          ) : (
            <span className="text-ink-soft">Puan verilmedi</span>
          )}
        </div>

        {/* İlerleme — yalnızca güvenilir hesaplanabiliyorsa yüzde gösterilir */}
        {progress.kind === "percent" && (
          <div className="mt-3">
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-ink-soft">
              {/* Sayıya göre değişen Türkçe eklerden kaçınmak için ek almayan ifade */}
              <span>
                {progress.watched} / {progress.total} bölüm izlendi
              </span>
              <span>%{Math.round(progress.percent)} tamamlandı</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-brand-soft"
              role="progressbar"
              aria-label={`${entry.title} izleme ilerlemesi`}
              aria-valuenow={Math.round(progress.percent)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuetext={`${progress.total} bölümden ${progress.watched} tanesi izlendi`}
            >
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${progress.ratio * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Aksiyonlar — dar ekranda alt satıra geçer */}
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          {isSeries && (
            <div className="mr-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => onEpisodeChange(entry, -1)}
                disabled={
                  (entry.currentEpisode ?? 1) <= 1 && (entry.currentSeason ?? 1) <= 1
                }
                aria-label={`${entry.title} bölümünü azalt`}
                className={`${iconButtonClass} border-line text-ink hover:border-brand hover:bg-brand-soft hover:text-brand`}
              >
                <Minus size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onEpisodeChange(entry, 1)}
                aria-label={`${entry.title} bölümünü artır`}
                className={`${iconButtonClass} border-brand bg-brand text-white hover:bg-brand-strong`}
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => onEdit(entry)}
            aria-label={`${entry.title} kaydını düzenle`}
            className={`${iconButtonClass} border-line text-ink-soft hover:border-brand hover:bg-brand-soft hover:text-brand`}
          >
            <Pencil size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(entry)}
            aria-label={`${entry.title} kaydını sil`}
            className={`${iconButtonClass} border-line text-ink-soft hover:border-danger hover:bg-danger-soft hover:text-danger`}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}

/**
 * Poster: URL varsa gösterilir, yüklenemezse sessizce yer tutucuya düşer.
 * next/image yerine düz <img> — keyfi harici alan adları için domain
 * yapılandırması gerektirmez.
 */
function Poster({ entry }: { entry: MediaEntry }) {
  const [failed, setFailed] = useState(false);
  const showImage = entry.posterUrl !== null && !failed;
  const letter = entry.title.trim().charAt(0).toLocaleUpperCase("tr") || "?";

  return (
    <div className="h-24 w-16 shrink-0 overflow-hidden rounded-xl border border-line-strong bg-brand-soft sm:h-28 sm:w-20">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.posterUrl ?? ""}
          alt={`${entry.title} afişi`}
          onError={() => setFailed(true)}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-full w-full flex-col items-center justify-center gap-1 text-brand"
        >
          <span className="text-2xl font-bold">{letter}</span>
          {entry.mediaType === "series" ? <Tv size={14} /> : <Clapperboard size={14} />}
        </div>
      )}
    </div>
  );
}
