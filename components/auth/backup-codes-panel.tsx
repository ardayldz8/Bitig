"use client";

import { useState } from "react";
import { Copy, Download, KeyRound } from "lucide-react";

/**
 * Kurtarma kodlarını BİR KEZ gösterir.
 *
 * Kodlar sunucuda yalnızca hash'li saklanıyor; bu ekran kapandıktan sonra
 * bir daha görüntülenemezler. Bu yüzden kaydetme yolları (kopyala / indir)
 * devam düğmesinden önce geliyor.
 */
export default function BackupCodesPanel({
  codes,
  onDone,
}: {
  codes: string[];
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const metin = [
    "Bitig kurtarma kodları",
    "",
    "Her kod bir kez kullanılabilir. Authenticator uygulamana erişemezsen",
    "e-posta ve şifrenle giriş yapıp bu kodlardan birini gir.",
    "",
    ...codes,
  ].join("\n");

  async function kopyala() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Pano erişimi reddedildi — kodlar zaten ekranda
    }
  }

  function indir() {
    const blob = new Blob([metin], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "bitig-kurtarma-kodlari.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-card border border-line bg-surface p-6 shadow-card">
      <span
        aria-hidden="true"
        className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand"
      >
        <KeyRound size={20} />
      </span>

      <h2 className="mt-3 text-lg font-semibold text-ink">Kurtarma kodların</h2>
      <p className="mt-1.5 text-sm text-ink-soft">
        Telefonunu kaybedersen bu kodlarla hesabına dönebilirsin. Her kod bir kez
        çalışır. <strong className="font-medium text-ink">Bu ekran bir daha
        gösterilmeyecek</strong> — kodlar sunucuda şifrelenmiş tutuluyor.
      </p>

      <ul className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-canvas p-4 font-mono text-sm text-ink">
        {codes.map((code) => (
          <li key={code} className="tracking-wider">
            {code}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void kopyala()}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand"
        >
          <Copy size={15} aria-hidden="true" />
          {copied ? "Kopyalandı" : "Kopyala"}
        </button>
        <button
          type="button"
          onClick={indir}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand"
        >
          <Download size={15} aria-hidden="true" />
          Dosya olarak indir
        </button>
      </div>

      <label className="mt-5 flex items-start gap-2.5 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0"
        />
        Kodları güvenli bir yere kaydettim.
      </label>

      <button
        type="button"
        onClick={onDone}
        disabled={!acknowledged}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-4 font-medium text-white transition-colors hover:bg-brand-strong disabled:opacity-50"
      >
        Devam et
      </button>
    </div>
  );
}
