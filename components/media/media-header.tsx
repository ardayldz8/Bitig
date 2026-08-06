"use client";

import { Clapperboard, Plus } from "lucide-react";

type MediaHeaderProps = {
  total: number;
  onAdd: () => void;
};

export default function MediaHeader({ total, onAdd }: MediaHeaderProps) {
  return (
    <header>
      <p className="text-sm font-semibold text-brand">Bitig</p>

      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        Dizi / Film Takibi
      </h1>
      <p className="mt-1.5 text-ink-soft">İzlediklerini takip et, hiçbir şeyi unutma.</p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 shadow-card">
          <span
            aria-hidden="true"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"
          >
            <Clapperboard size={20} />
          </span>
          <span className="text-sm text-ink-soft">
            Toplam{" "}
            <strong className="text-base font-bold text-ink">{total}</strong> yapım
          </span>
        </span>

        {/* Mobilde de her zaman erişilebilir görünür ekleme butonu */}
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 py-2.5 font-medium text-white transition-colors hover:bg-brand-strong"
        >
          <Plus size={18} aria-hidden="true" />
          Yeni yapım ekle
        </button>
      </div>
    </header>
  );
}
