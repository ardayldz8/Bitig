"use client";

import { useState } from "react";
import { Download, ShieldAlert } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { backupFileName, buildBackup, countRows } from "@/lib/backup/export";

/**
 * Yedek indirme.
 *
 * Veriler tek bir Supabase projesinde ve başka kopyası yok. Dosya tamamen
 * tarayıcıda üretilir; sunucuya ya da üçüncü tarafa hiçbir şey gönderilmez.
 */
export default function DataBackup() {
  const { client, userId, userEmail } = useAuth();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function run() {
    if (!client || !userId || busy) return;

    setBusy(true);
    setError(null);
    setDone(null);

    try {
      const backup = await buildBackup(client, userId, userEmail);

      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = backupFileName(backup.exportedAt);
      link.click();
      // Blob'u serbest bırak; yoksa sekme kapanana kadar bellekte kalır
      URL.revokeObjectURL(url);

      const eksik = Object.keys(backup.errors);
      setDone(
        eksik.length > 0
          ? `${countRows(backup)} kayıt indirildi. Şu tablolar okunamadı: ${eksik.join(", ")}.`
          : `${countRows(backup)} kayıt indirildi.`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Yedek oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"
        >
          <ShieldAlert size={18} />
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-ink">Verilerini yedekle</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Manga, kalori, dizi/film ve proje kayıtlarının tamamını tek bir JSON
            dosyası olarak indirir. Dosya cihazında üretilir, hiçbir yere gönderilmez.
          </p>

          {error && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {error}
            </p>
          )}
          {done && <p className="mt-3 text-sm text-ok">{done}</p>}

          <button
            type="button"
            onClick={() => void run()}
            disabled={busy || !client}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
          >
            <Download size={16} aria-hidden="true" />
            {busy ? "Hazırlanıyor…" : "Yedeği indir"}
          </button>
        </div>
      </div>
    </section>
  );
}
