"use client";

import { Github } from "lucide-react";
import { PROJECT_STATUS_LABELS, type Project, type ProjectStatus } from "@/types/project";

const STATUS_DOT: Record<ProjectStatus, string> = {
  active: "bg-emerald-500",
  on_hold: "bg-amber-500",
  completed: "bg-brand",
  archived: "bg-ink-soft/40",
};

function relativeTime(iso: string): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return "";
  const minutes = Math.floor((Date.now() - time) / 60_000);
  if (minutes < 1) return "az önce";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "dün" : `${days} gün önce`;
}

type ItemProps = {
  project: Project;
  selected: boolean;
  featureCount: number;
  onSelect: (id: string) => void;
};

export default function ProjectListItem({
  project,
  selected,
  featureCount,
  onSelect,
}: ItemProps) {
  const letter = project.name.trim().charAt(0).toLocaleUpperCase("tr") || "?";

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(project.id)}
        aria-current={selected ? "true" : undefined}
        className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors ${
          selected ? "bg-brand-soft ring-1 ring-brand/30" : "hover:bg-canvas"
        }`}
      >
        <span
          aria-hidden="true"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand text-sm font-bold text-white"
        >
          {letter}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-ink">{project.name}</span>
            {project.githubFullName && (
              <Github
                size={13}
                aria-label="GitHub bağlı"
                className="shrink-0 text-ink-soft"
              />
            )}
          </span>
          {project.description && (
            <span className="mt-0.5 block truncate text-xs text-ink-soft">
              {project.description}
            </span>
          )}
          <span className="mt-1 block text-[11px] text-ink-soft">
            {featureCount} özellik · {relativeTime(project.updatedAt)}
          </span>
        </span>

        <span className="flex shrink-0 flex-col items-end gap-1">
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${STATUS_DOT[project.status]}`}
          />
          <span className="sr-only">{PROJECT_STATUS_LABELS[project.status]}</span>
        </span>
      </button>
    </li>
  );
}
