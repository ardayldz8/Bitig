"use client";

import { STATUS_LABELS, type StatusFilter, type TypeFilter } from "@/types/media";

type MediaFilterTabsProps = {
  status: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
  type: TypeFilter;
  onTypeChange: (value: TypeFilter) => void;
};

const STATUS_OPTIONS: { value: StatusFilter; label: string; dot: string }[] = [
  { value: "all", label: "Tümü", dot: "" },
  { value: "watching", label: STATUS_LABELS.watching, dot: "bg-brand" },
  { value: "completed", label: STATUS_LABELS.completed, dot: "bg-ok" },
  { value: "planned", label: STATUS_LABELS.planned, dot: "bg-amber-500" },
];

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "series", label: "Diziler" },
  { value: "movie", label: "Filmler" },
];

function chipClass(active: boolean): string {
  return [
    "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
    active
      ? "bg-brand text-white"
      : "bg-surface text-ink-soft ring-1 ring-line hover:text-brand",
  ].join(" ");
}

export default function MediaFilterTabs({
  status,
  onStatusChange,
  type,
  onTypeChange,
}: MediaFilterTabsProps) {
  return (
    <div className="space-y-3">
      {/* Durum filtresi */}
      <div>
        <p id="media-status-filter" className="mb-1.5 text-sm font-medium text-ink-soft">
          Durum
        </p>
        {/* Dar ekranda yatay kaydırılır; sayfa taşmaz */}
        <div
          role="group"
          aria-labelledby="media-status-filter"
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        >
          {STATUS_OPTIONS.map((option) => {
            const active = status === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onStatusChange(option.value)}
                aria-pressed={active}
                className={chipClass(active)}
              >
                {option.dot && (
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 rounded-full ${active ? "bg-white" : option.dot}`}
                  />
                )}
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Yapım türü filtresi */}
      <div>
        <p id="media-type-filter" className="mb-1.5 text-sm font-medium text-ink-soft">
          Yapım türü
        </p>
        <div
          role="group"
          aria-labelledby="media-type-filter"
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        >
          {TYPE_OPTIONS.map((option) => {
            const active = type === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onTypeChange(option.value)}
                aria-pressed={active}
                className={chipClass(active)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
