"use client";

import { useId } from "react";
import Modal from "@/components/ui/modal";
import type { Manga } from "@/types/manga";

type MangaDeleteDialogProps = {
  manga: Manga;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function MangaDeleteDialog({
  manga,
  onConfirm,
  onCancel,
}: MangaDeleteDialogProps) {
  const baseId = useId();

  return (
    <Modal title="Kaydı sil" titleId={`${baseId}-title`} onClose={onCancel}>
      <p className="text-ink-soft">
        <span className="font-medium text-ink">{manga.name}</span> kaydı silinecek. Bu
        işlem geri alınamaz.
      </p>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-line px-4 py-2.5 font-medium text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand"
        >
          Vazgeç
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-xl bg-danger px-5 py-2.5 font-medium text-white transition-colors hover:brightness-95"
        >
          Sil
        </button>
      </div>
    </Modal>
  );
}
