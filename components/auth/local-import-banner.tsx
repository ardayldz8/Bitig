"use client";

import { useEffect, useState } from "react";
import { UploadCloud, X } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  countLocal,
  dismiss,
  importLocalData,
  isDismissed,
  readLocalSnapshot,
  type LocalCounts,
  type LocalSnapshot,
} from "@/lib/cloud/import-local";

function summarize(counts: LocalCounts): string {
  const parts: string[] = [];
  if (counts.mangas > 0) parts.push(`${counts.mangas} manga`);
  if (counts.mediaEntries > 0) parts.push(`${counts.mediaEntries} dizi/film`);
  return parts.join(", ");
}

/**
 * Bu cihazda kalmış eski verileri hesaba taşıma teklifi.
 *
 * Buluta geçişten önce kaydedilen manga/dizi verileri yalnızca
 * tarayıcıda duruyor. Taşınmazsa erişilemez hâle gelirler, o yüzden sessizce
 * yok saymak yerine bir kez açıkça soruluyor.
 */
export default function LocalImportBanner() {
  const { client, userId, status } = useAuth();

  const [snapshot, setSnapshot] = useState<LocalSnapshot | null>(null);
  const [counts, setCounts] = useState<LocalCounts | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // localStorage yalnızca mount sonrası okunur → hydration uyuşmazlığı olmaz
  useEffect(() => {
    if (status !== "signed_in" || isDismissed()) return;

    const local = readLocalSnapshot();
    const found = countLocal(local);
    if (found.total === 0) return;

    setSnapshot(local);
    setCounts(found);
  }, [status]);

  // Aktarım bittiğinde counts temizlenir ama sonuç mesajı bir süre görünmeli
  if (!counts && !done) return null;

  async function run() {
    if (!client || !userId || !snapshot || busy) return;

    setBusy(true);
    setError(null);
    try {
      const result = await importLocalData(client, userId, snapshot);

      const moved = summarize(result.imported);
      const note =
        result.skipped.length > 0
          ? ` ${result.skipped.join(" ve ")} modülünde hesabında zaten kayıt olduğu için atlandı; bu cihazdaki veriler silinmedi.`
          : "";

      setDone(
        result.imported.total > 0
          ? `Aktarıldı: ${moved}.${note}`
          : `Aktarılacak yeni kayıt yoktu.${note}`,
      );
      setCounts(null);
      setSnapshot(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Aktarım başarısız oldu.");
    } finally {
      setBusy(false);
    }
  }

  function skip() {
    dismiss();
    setCounts(null);
    setSnapshot(null);
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pt-4 sm:px-6">
      {counts && (
      <div className="rounded-card border border-brand/30 bg-brand-soft p-4">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="mt-0.5 text-brand">
            <UploadCloud size={20} />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">
              Bu cihazda hesabına bağlı olmayan kayıtlar var
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              {summarize(counts)} yalnızca bu tarayıcıda duruyor. Hesabına aktarırsan
              diğer cihazlarından da erişebilirsin.
            </p>

            {error && (
              <p role="alert" className="mt-2 text-sm text-danger">
                {error}
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void run()}
                disabled={busy}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-strong disabled:opacity-50"
              >
                {busy ? "Aktarılıyor…" : "Hesabıma aktar"}
              </button>
              <button
                type="button"
                onClick={skip}
                disabled={busy}
                className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-4 text-sm text-ink-soft transition-colors hover:text-ink disabled:opacity-50"
              >
                Şimdi değil
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={skip}
            aria-label="Kapat"
            className="text-ink-soft transition-colors hover:text-ink"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
      )}

      {done && (
        <p className="mt-2 rounded-xl bg-surface px-3.5 py-2.5 text-sm text-ink-soft">{done}</p>
      )}
    </div>
  );
}
