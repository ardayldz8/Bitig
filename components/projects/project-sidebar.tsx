"use client";

import { Archive, Github, Search } from "lucide-react";
import ProjectListItem from "@/components/projects/project-list-item";
import type { Project, ProjectStatus } from "@/types/project";

export type ProjectFilter = ProjectStatus | "all" | "github";

const FILTERS: { value: ProjectFilter; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "active", label: "Aktif" },
  { value: "on_hold", label: "Beklemede" },
  { value: "completed", label: "Tamamlandı" },
  { value: "archived", label: "Arşivlendi" },
  { value: "github", label: "GitHub bağlı" },
];

type SidebarProps = {
  projects: Project[];
  selectedId: string | null;
  query: string;
  filter: ProjectFilter;
  featureCounts: Record<string, number>;
  onQueryChange: (value: string) => void;
  onFilterChange: (value: ProjectFilter) => void;
  onSelect: (id: string) => void;
};

export default function ProjectSidebar({
  projects,
  selectedId,
  query,
  filter,
  featureCounts,
  onQueryChange,
  onFilterChange,
  onSelect,
}: SidebarProps) {
  const archivedCount = projects.filter((p) => p.status === "archived").length;

  return (
    <div className="flex h-full flex-col rounded-card border border-line bg-surface p-3">
      <div className="relative">
        <label htmlFor="project-search" className="sr-only">
          Proje ara
        </label>
        <Search
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-soft"
        />
        <input
          id="project-search"
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Proje ara..."
          className="min-h-11 w-full rounded-xl border border-line bg-canvas py-2 pr-3 pl-9 text-sm text-ink placeholder:text-ink-soft/70"
        />
      </div>

      <div
        role="group"
        aria-label="Proje filtreleri"
        className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1"
      >
        {FILTERS.map((option) => {
          const active = filter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onFilterChange(option.value)}
              aria-pressed={active}
              className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors ${
                active
                  ? "bg-brand text-white"
                  : "text-ink-soft ring-1 ring-line hover:text-brand"
              }`}
            >
              {option.value === "github" && <Github size={13} aria-hidden="true" />}
              {option.label}
            </button>
          );
        })}
      </div>

      <ul className="mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto">
        {projects.length === 0 ? (
          <li className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-soft">
            Bu filtrelere uygun proje yok.
          </li>
        ) : (
          projects.map((project) => (
            <ProjectListItem
              key={project.id}
              project={project}
              selected={project.id === selectedId}
              featureCount={featureCounts[project.id] ?? 0}
              onSelect={onSelect}
            />
          ))
        )}
      </ul>

      {archivedCount > 0 && (
        <button
          type="button"
          onClick={() => onFilterChange("archived")}
          className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line text-sm text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand"
        >
          <Archive size={15} aria-hidden="true" />
          Arşivlenenler ({archivedCount})
        </button>
      )}
    </div>
  );
}
