"use client";

import { ArrowLeft, ExternalLink, Github, Pencil, RefreshCw, Trash2 } from "lucide-react";
import ProjectTabs from "@/components/projects/project-tabs";
import { PROJECT_STATUS_LABELS, type Project, type ProjectStatus, type ProjectTab } from "@/types/project";
import type { RepositorySnapshot } from "@/types/github";

const STATUS_STYLE: Record<ProjectStatus, string> = {
  active: "bg-ok-soft text-ok",
  on_hold: "bg-amber-100 text-amber-700",
  completed: "bg-brand-soft text-brand-strong",
  archived: "bg-canvas text-ink-soft ring-1 ring-line",
};

type DetailProps = {
  project: Project;
  snapshot: RepositorySnapshot | null;
  tab: ProjectTab;
  syncing: boolean;
  syncError: string | null;
  canSync: boolean;
  onTabChange: (tab: ProjectTab) => void;
  onEdit: () => void;
  onDelete: () => void;
  onSync: () => void;
  onLinkRepository: () => void;
  onBack: () => void;
  children: React.ReactNode;
};

export default function ProjectDetail({
  project,
  snapshot,
  tab,
  syncing,
  syncError,
  canSync,
  onTabChange,
  onEdit,
  onDelete,
  onSync,
  onLinkRepository,
  onBack,
  children,
}: DetailProps) {
  const letter = project.name.trim().charAt(0).toLocaleUpperCase("tr") || "?";
  const created = new Date(project.createdAt);

  return (
    <div className="rounded-card border border-line bg-surface p-4 sm:p-5">
      {/* Mobilde listeye dönüş */}
      <button
        type="button"
        onClick={onBack}
        className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-ink-soft transition-colors hover:text-brand lg:hidden"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Projelere dön
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span
            aria-hidden="true"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand text-lg font-bold text-white"
          >
            {letter}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-ink">{project.name}</h2>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[project.status]}`}
              >
                {PROJECT_STATUS_LABELS[project.status]}
              </span>
            </div>
            {project.description && (
              <p className="mt-0.5 text-sm text-ink-soft">{project.description}</p>
            )}

            {/* Dar ekranda gap-x-4 satırı sıkıştırıyordu; ayraçlarla okunur hâle geliyor */}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
              <span>
                Oluşturulma:{" "}
                {Number.isNaN(created.getTime())
                  ? "—"
                  : created.toLocaleDateString("tr-TR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
              </span>
              {project.technologies.length > 0 && (
                <span>{project.technologies.join(", ")}</span>
              )}
              {project.githubFullName ? (
                <a
                  href={`https://github.com/${project.githubFullName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-brand hover:underline"
                >
                  <Github size={12} aria-hidden="true" />
                  {project.githubFullName}
                  <ExternalLink size={11} aria-hidden="true" />
                </a>
              ) : (
                <button
                  type="button"
                  onClick={onLinkRepository}
                  className="-my-2 inline-flex min-h-11 items-center gap-1 text-brand hover:underline"
                >
                  <Github size={12} aria-hidden="true" />
                  Repository bağla
                </button>
              )}
              {snapshot && (
                <span>Branch: {snapshot.repository.defaultBranch}</span>
              )}
              {project.lastSyncedAt && (
                <span>
                  Son senkron:{" "}
                  {new Date(project.lastSyncedAt).toLocaleString("tr-TR", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-1.5">
          <button
            type="button"
            onClick={onSync}
            disabled={!canSync || syncing}
            aria-label="Repository'yi yeniden senkronize et"
            title={canSync ? "Senkronize et" : "Repository bağlı değil"}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-3 text-sm text-ink-soft transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCw
              size={15}
              aria-hidden="true"
              className={syncing ? "animate-spin" : ""}
            />
            {syncing ? "Senkronize ediliyor…" : "Senkronize et"}
          </button>
          <button
            type="button"
            onClick={onEdit}
            aria-label={`${project.name} projesini düzenle`}
            className="grid h-11 w-11 place-items-center rounded-lg border border-line text-ink-soft transition-colors hover:border-brand hover:text-brand"
          >
            <Pencil size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`${project.name} projesini sil`}
            className="grid h-11 w-11 place-items-center rounded-lg border border-line text-ink-soft transition-colors hover:border-danger hover:text-danger"
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {syncError && (
        <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
          {syncError}
        </p>
      )}

      <div className="mt-4">
        <ProjectTabs active={tab} onChange={onTabChange} />
      </div>

      <div className="mt-4">{children}</div>
    </div>
  );
}
