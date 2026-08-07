"use client";

import { useId } from "react";
import Modal from "@/components/ui/modal";
import RepositoryList, { type Repo } from "@/components/projects/repository-list";

/**
 * Repository seçimini kendi penceresinde gösterir.
 *
 * Liste ve arama mantığı RepositoryList'te; burası yalnızca diyalog kabuğu.
 * Aynı liste "Yeni proje" formunun içine gömülü olarak da kullanılıyor.
 */
export default function RepositoryPicker({
  installationId,
  accessToken,
  onPick,
  onClose,
}: {
  installationId: number;
  accessToken: string | null;
  onPick: (repo: Repo) => void;
  onClose: () => void;
}) {
  const baseId = useId();

  return (
    <Modal title="Repository seç" titleId={`${baseId}-t`} onClose={onClose}>
      <RepositoryList
        installationId={installationId}
        accessToken={accessToken}
        onPick={onPick}
      />
    </Modal>
  );
}
