"use client";

import { Plus } from "lucide-react";

type MediaEmptyStateProps = {
  /** true ise filtreler yüzünden boş, false ise hiç kayıt yok. */
  filtered: boolean;
  onAdd: () => void;
  onClearFilters: () => void;
};

export default function MediaEmptyState({
  filtered,
  onAdd,
  onClearFilters,
}: MediaEmptyStateProps) {
  if (filtered) {
    return (
      <div className="rounded-card border border-dashed border-line-strong bg-surface p-10 text-center">
        <p className="font-medium text-ink">Bu filtrelere uygun yapım bulunamadı.</p>
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-line px-4 py-2.5 font-medium text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand"
        >
          Filtreleri temizle
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-dashed border-line-strong bg-surface p-10 text-center">
      <p className="font-medium text-ink">Henüz dizi veya film eklemedin.</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-soft">
        İzlemeye başladığın ilk yapımı ekleyerek kişisel arşivini oluşturmaya başla.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 py-2.5 font-medium text-white transition-colors hover:bg-brand-strong"
      >
        <Plus size={18} aria-hidden="true" />
        İlk yapımı ekle
      </button>
    </div>
  );
}
