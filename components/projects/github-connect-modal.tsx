"use client";

import { useId } from "react";
import { Github, ShieldCheck } from "lucide-react";
import Modal from "@/components/ui/modal";

const PERMISSIONS = [
  "Metadata: Read",
  "Contents: Read",
  "Pull requests: Read",
  "Issues: Read (issue açmak için Read & Write)",
  "Actions: Read",
  "Checks: Read",
  "Commit statuses: Read",
];

const STEPS = [
  "GitHub App kurulum sayfası açılır",
  "Hesap veya organizasyon seçersin",
  "Erişim verilecek repository'leri seçersin",
  "Bitig'e geri dönersin, kurulum kaydedilir",
  "Projeye bağlayacağın repository'yi seçersin",
];

export default function GithubConnectModal({
  configured,
  missing,
  onClose,
}: {
  configured: boolean;
  missing: string[];
  onClose: () => void;
}) {
  const baseId = useId();

  return (
    <Modal title="GitHub'ı bağla" titleId={`${baseId}-t`} onClose={onClose}>
      <p className="flex items-start gap-2 rounded-xl bg-brand-soft px-3.5 py-3 text-sm text-brand-strong">
        <ShieldCheck size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
        Bitig repository içeriğini <strong>değiştiremez</strong>. Yalnızca okuma izinleri
        istenir; issue açılması senin açık onayınla olur.
      </p>

      <div className="mt-4">
        <h3 className="text-sm font-medium text-ink">Kurulum adımları</h3>
        <ol className="mt-2 space-y-1.5 text-sm text-ink-soft">
          {STEPS.map((step, index) => (
            <li key={step}>
              {index + 1}. {step}
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-medium text-ink">İstenen izinler</h3>
        <ul className="mt-2 space-y-1 text-sm text-ink-soft">
          {PERMISSIONS.map((permission) => (
            <li key={permission}>• {permission}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink-soft">
          Contents: Write, Administration ve Workflows izinleri <strong>istenmez</strong>.
        </p>
      </div>

      {!configured && (
        <div className="mt-4 rounded-xl bg-amber-100 px-3.5 py-3 text-sm text-amber-800">
          <p className="font-medium">GitHub App henüz yapılandırılmamış.</p>
          <p className="mt-1">
            Sunucuda şu ortam değişkenleri eksik:{" "}
            <code className="font-mono text-xs">{missing.join(", ")}</code>
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line px-4 font-medium text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand"
        >
          Kapat
        </button>
        <a
          href={configured ? "/api/github/install" : undefined}
          aria-disabled={!configured}
          onClick={(event) => {
            if (!configured) event.preventDefault();
          }}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 font-medium transition-colors ${
            configured
              ? "bg-brand text-white hover:bg-brand-strong"
              : "cursor-not-allowed bg-brand/40 text-white"
          }`}
        >
          <Github size={16} aria-hidden="true" />
          GitHub App&apos;i kur
        </a>
      </div>
    </Modal>
  );
}
