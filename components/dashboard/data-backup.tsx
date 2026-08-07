"use client";

import { useId, useRef, useState } from "react";
import { Download, ShieldAlert, Upload } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { backupFileName, buildBackup, countRows, type Backup } from "@/lib/backup/export";
import { parseBackup, restoreBackup, type BackupSummary } from "@/lib/backup/import";

const TABLO_ADLARI: Record<string, string> = {
  mangas: "Manga",
  media_entries: "Dizi / Film",
  food_entries: "Yemek kaydı",
  nutrition_targets: "Beslenme hedefi",
  projects: "Proje",
  project_features: "Özellik",
  project_notes: "Not",
  project_tasks: "Görev",
  project_activities: "Aktivite",
  ai_project_snapshots: "AI özeti",
};

const adlandir = (table: string) => TABLO_ADLARI[table] ?? table;

/**
 * Yedek alma ve geri yükleme.
 *
 * Veriler tek bir Supabase projesinde ve başka kopyası yok. Dosya tamamen
 * tarayıcıda işlenir; sunucuya ya da üçüncü tarafa hiçbir şey gönderilmez.
 */
export default function DataBackup() {
  const { client, userId, userEmail } = useAuth();
  const dosyaId = useId();
  const dosyaRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Geri yükleme onay bekleyen dosya
  const [pending, setPending] = useState<{ backup: Backup; summary: BackupSummary } | null>(
    null,
  );

  async function indir() {
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

  async function dosyaSecildi(file: File | undefined) {
    if (!file) return;

    setError(null);
    setDone(null);
    setPending(null);

    const raw = await file.text();
    const parsed = parseBackup(raw);

    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    if (parsed.summary.total === 0) {
      setError("Dosyada geri yüklenecek kayıt yok.");
      return;
    }

    setPending({ backup: parsed.backup, summary: parsed.summary });
  }

  async function geriYukle() {
    if (!client || !userId || !pending || busy) return;

    setBusy(true);
    setError(null);

    try {
      const sonuc = await restoreBackup(client, userId, pending.backup);
      const yazilan = sonuc.written.reduce((sum, item) => sum + item.rows, 0);

      if (sonuc.errors.length > 0) {
        setError(
          `Bazı tablolar yazılamadı: ${sonuc.errors
            .map((item) => `${adlandir(item.table)} (${item.message})`)
            .join(", ")}`,
        );
      }
      setDone(
        yazilan > 0
          ? `${yazilan} kayıt geri yüklendi. Sayfayı yenile.`
          : "Hiçbir kayıt yazılamadı.",
      );
      setPending(null);
      if (dosyaRef.current) dosyaRef.current.value = "";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Geri yükleme başarısız.");
    } finally {
      setBusy(false);
    }
  }

  function iptal() {
    setPending(null);
    if (dosyaRef.current) dosyaRef.current.value = "";
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
            dosyası olarak indirir. Dosya cihazında işlenir, hiçbir yere gönderilmez.
          </p>

          {error && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {error}
            </p>
          )}
          {done && <p className="mt-3 text-sm text-ok">{done}</p>}

          {/* Onay ekranı: ne yazılacağı yazmadan ÖNCE görünür */}
          {pending ? (
            <div className="mt-4 rounded-xl border border-line bg-canvas p-4">
              <p className="text-sm font-medium text-ink">Geri yüklenecek kayıtlar</p>
              {pending.summary.email && (
                <p className="mt-1 text-xs text-ink-soft">
                  Yedek sahibi: {pending.summary.email}
                  {pending.summary.email !== userEmail && " — şu anki hesaptan farklı"}
                </p>
              )}

              <ul className="mt-3 space-y-1 text-sm text-ink-soft">
                {pending.summary.counts.map((item) => (
                  <li key={item.table}>
                    {adlandir(item.table)}: <strong className="text-ink">{item.rows}</strong>
                  </li>
                ))}
              </ul>

              {pending.summary.skipped.length > 0 && (
                <p className="mt-3 text-xs text-ink-soft">
                  Geri yüklenmeyecek (yeniden bağlanabilir/senkronize edilebilir):{" "}
                  {pending.summary.skipped.map((item) => adlandir(item.table)).join(", ")}
                </p>
              )}

              <p className="mt-3 text-xs text-ink-soft">
                Aynı kimliğe sahip mevcut kayıtların üzerine yazılır. Yeni kayıtların
                silinmez.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void geriYukle()}
                  disabled={busy}
                  className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-strong disabled:opacity-50"
                >
                  {busy ? "Yazılıyor…" : "Geri yükle"}
                </button>
                <button
                  type="button"
                  onClick={iptal}
                  disabled={busy}
                  className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm text-ink-soft transition-colors hover:text-ink disabled:opacity-50"
                >
                  İptal
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void indir()}
                disabled={busy || !client}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
              >
                <Download size={16} aria-hidden="true" />
                {busy ? "Hazırlanıyor…" : "Yedeği indir"}
              </button>

              <label
                htmlFor={dosyaId}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-line px-4 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand"
              >
                <Upload size={16} aria-hidden="true" />
                Yedekten geri yükle
              </label>
              <input
                ref={dosyaRef}
                id={dosyaId}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(event) => void dosyaSecildi(event.target.files?.[0])}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
