"use client";

import { Github, Plus } from "lucide-react";

type HeaderProps = {
  githubConnected: boolean;
  githubAccount: string | null;
  localMode: boolean;
  onNewProject: () => void;
  onConnectGithub: () => void;
};

export default function ProjectsHeader({
  githubConnected,
  githubAccount,
  localMode,
  onNewProject,
  onConnectGithub,
}: HeaderProps) {
  return (
    <header>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Projelerim
          </h1>
          <p className="mt-1.5 text-ink-soft">
            Projelerini takip et, geliştirme sürecini organize et.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {githubConnected ? (
            <span className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3.5 text-sm text-ink-soft">
              <Github size={16} aria-hidden="true" className="text-ok" />
              GitHub bağlı
              {githubAccount && (
                <strong className="font-medium text-ink">@{githubAccount}</strong>
              )}
            </span>
          ) : (
            <button
              type="button"
              onClick={onConnectGithub}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand"
            >
              <Github size={16} aria-hidden="true" />
              GitHub&apos;ı bağla
            </button>
          )}

          <button
            type="button"
            onClick={onNewProject}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-strong"
          >
            <Plus size={16} aria-hidden="true" />
            Yeni proje
          </button>
        </div>
      </div>

      {localMode && (
        <p className="mt-3 rounded-xl bg-amber-100 px-3.5 py-2.5 text-sm text-amber-800">
          Yerel mod: Supabase yapılandırılmadığı için projeler yalnızca bu tarayıcıda
          saklanıyor. Kurulum için <code className="font-mono text-xs">supabase/migrations</code>{" "}
          altındaki şemayı uygula ve Supabase değişkenlerini tanımla.
        </p>
      )}
    </header>
  );
}
