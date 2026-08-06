"use client";

import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { ProjectActivity } from "@/types/project";

const FILTERS = [
  { value: "all", label: "Tümü" },
  { value: "github", label: "GitHub" },
  { value: "bitig", label: "Bitig" },
  { value: "ai", label: "AI" },
  { value: "push", label: "Commit" },
  { value: "pull_request", label: "PR" },
  { value: "issue", label: "Issue" },
  { value: "workflow_run", label: "CI" },
] as const;

type FilterValue = (typeof FILTERS)[number]["value"];

const SOURCE_STYLE: Record<ProjectActivity["source"], string> = {
  github: "bg-canvas text-ink-soft ring-1 ring-line",
  bitig: "bg-brand-soft text-brand-strong",
  ai: "bg-violet-100 text-violet-700",
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

export default function ProjectActivityFeed({
  activities,
}: {
  activities: ProjectActivity[];
}) {
  const [filter, setFilter] = useState<FilterValue>("all");

  const visible = useMemo(() => {
    const sorted = [...activities].sort((a, b) =>
      b.occurredAt.localeCompare(a.occurredAt),
    );
    if (filter === "all") return sorted;
    if (filter === "github" || filter === "bitig" || filter === "ai") {
      return sorted.filter((item) => item.source === filter);
    }
    return sorted.filter((item) => item.type === filter);
  }, [activities, filter]);

  return (
    <section>
      <div
        role="group"
        aria-label="Aktivite filtresi"
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
      >
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            aria-pressed={filter === option.value}
            className={`min-h-11 shrink-0 rounded-full px-3.5 text-sm font-medium transition-colors ${
              filter === option.value
                ? "bg-brand text-white"
                : "text-ink-soft ring-1 ring-line hover:text-brand"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <ol className="mt-3 space-y-2">
        {visible.length === 0 ? (
          <li className="rounded-card border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-ink-soft">
            Bu filtreye uygun aktivite yok.
          </li>
        ) : (
          visible.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-3 rounded-card border border-line bg-surface p-3.5"
            >
              <span className="w-14 shrink-0 pt-0.5 text-xs tabular-nums text-ink-soft">
                {formatTime(item.occurredAt)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-ink">{item.title}</span>
                {item.description && (
                  <span className="mt-0.5 block text-xs text-ink-soft">
                    {item.description}
                  </span>
                )}
                <span
                  className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${SOURCE_STYLE[item.source]}`}
                >
                  {item.source === "github" ? "GitHub" : item.source === "ai" ? "AI" : "Bitig"}
                </span>
              </span>
              {item.externalUrl && (
                <a
                  href={item.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${item.title} — GitHub'da aç`}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-line text-ink-soft transition-colors hover:border-brand hover:text-brand"
                >
                  <ExternalLink size={15} aria-hidden="true" />
                </a>
              )}
            </li>
          ))
        )}
      </ol>
    </section>
  );
}
