"use client";

import { useEffect, useId, useState } from "react";
import { Github, Lock } from "lucide-react";
import Modal from "@/components/ui/modal";

type Repo = {
  fullName: string;
  name: string;
  description: string | null;
  isPrivate: boolean;
  language: string | null;
  defaultBranch: string;
};

export default function RepositoryPicker({
  installationId,
  onPick,
  onClose,
}: {
  installationId: number;
  onPick: (repo: Repo) => void;
  onClose: () => void;
}) {
  const baseId = useId();
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/github/repositories?installationId=${installationId}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const message =
            typeof payload === "object" && payload !== null
              ? (payload as { error?: unknown }).error
              : null;
          throw new Error(
            typeof message === "string" ? message : "Repository listesi alınamadı.",
          );
        }
        const list =
          typeof payload === "object" && payload !== null
            ? (payload as { repositories?: unknown }).repositories
            : null;
        setRepos(Array.isArray(list) ? (list as Repo[]) : []);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : "Repository listesi alınamadı.");
      });

    return () => controller.abort();
  }, [installationId]);

  const visible = (repos ?? []).filter((repo) =>
    repo.fullName.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <Modal title="Repository seç" titleId={`${baseId}-t`} onClose={onClose}>
      <label htmlFor={`${baseId}-q`} className="mb-1.5 block text-sm font-medium text-ink">
        Repository ara
      </label>
      <input
        id={`${baseId}-q`}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="kullanici/repo"
        className="min-h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-ink"
      />

      <div aria-live="polite" className="mt-4">
        {error && (
          <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        {!error && repos === null && (
          <p className="text-sm text-ink-soft">Repository&apos;ler alınıyor…</p>
        )}

        {!error && repos !== null && visible.length === 0 && (
          <p className="text-sm text-ink-soft">Eşleşen repository bulunamadı.</p>
        )}

        <ul className="mt-2 max-h-80 space-y-1.5 overflow-y-auto">
          {visible.map((repo) => (
            <li key={repo.fullName}>
              <button
                type="button"
                onClick={() => onPick(repo)}
                className="flex w-full min-h-11 items-start gap-3 rounded-xl border border-line p-3 text-left transition-colors hover:border-brand hover:bg-brand-soft"
              >
                <Github size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-soft" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-ink">
                      {repo.fullName}
                    </span>
                    {repo.isPrivate && (
                      <Lock size={12} aria-label="Özel repository" className="text-ink-soft" />
                    )}
                  </span>
                  {repo.description && (
                    <span className="mt-0.5 block truncate text-xs text-ink-soft">
                      {repo.description}
                    </span>
                  )}
                  <span className="text-[11px] text-ink-soft">
                    {repo.language ?? "—"} · {repo.defaultBranch}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
