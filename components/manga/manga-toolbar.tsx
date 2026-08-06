"use client";

import { Search } from "lucide-react";
import { SORT_OPTIONS } from "@/lib/manga";
import type { SortKey } from "@/types/manga";

type MangaToolbarProps = {
  query: string;
  onQueryChange: (value: string) => void;
  sort: SortKey;
  onSortChange: (value: SortKey) => void;
};

function isSortKey(value: string): value is SortKey {
  return SORT_OPTIONS.some((option) => option.value === value);
}

export default function MangaToolbar({
  query,
  onQueryChange,
  sort,
  onSortChange,
}: MangaToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label
          htmlFor="manga-search"
          className="mb-1.5 block text-sm font-medium text-ink-soft"
        >
          Manga ara
        </label>
        <div className="relative">
          <Search
            size={18}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-soft"
          />
          <input
            id="manga-search"
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Örn: Berserk"
            className="w-full rounded-xl border border-line bg-surface py-2.5 pr-4 pl-10 text-ink placeholder:text-ink-soft/70"
          />
        </div>
      </div>

      <div className="sm:w-56">
        <label
          htmlFor="manga-sort"
          className="mb-1.5 block text-sm font-medium text-ink-soft"
        >
          Sırala
        </label>
        <select
          id="manga-sort"
          value={sort}
          onChange={(event) => {
            if (isSortKey(event.target.value)) onSortChange(event.target.value);
          }}
          className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-ink"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
