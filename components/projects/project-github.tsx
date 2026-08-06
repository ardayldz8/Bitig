"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Github } from "lucide-react";
import type { RepositorySnapshot } from "@/types/github";

const SUB_TABS = [
  "commits",
  "pulls",
  "issues",
  "actions",
  "branches",
  "releases",
] as const;
type SubTab = (typeof SUB_TABS)[number];

const SUB_LABELS: Record<SubTab, string> = {
  commits: "Commitler",
  pulls: "Pull Requestler",
  issues: "Issues",
  actions: "Actions",
  branches: "Branchler",
  releases: "Releases",
};

export default function ProjectGithub({
  snapshot,
  connected,
}: {
  snapshot: RepositorySnapshot | null;
  connected: boolean;
}) {
  const [sub, setSub] = useState<SubTab>("commits");

  if (!connected || !snapshot) {
    return (
      <div className="rounded-card border border-dashed border-line-strong bg-surface p-8 text-center">
        <Github size={28} aria-hidden="true" className="mx-auto text-ink-soft" />
        <p className="mt-3 font-medium text-ink">Bu proje bir repository&apos;ye bağlı değil</p>
        <p className="mt-1 text-sm text-ink-soft">
          GitHub&apos;ı bağlayıp bir repository seçtiğinde commitler, PR&apos;lar, issue&apos;lar ve CI
          durumu burada görünür.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="GitHub bölümleri"
        className="-mx-1 flex gap-1 overflow-x-auto px-1"
      >
        {SUB_TABS.map((item) => (
          <button
            key={item}
            role="tab"
            type="button"
            aria-selected={sub === item}
            onClick={() => setSub(item)}
            className={`min-h-11 shrink-0 rounded-full px-3.5 text-sm font-medium transition-colors ${
              sub === item ? "bg-brand text-white" : "text-ink-soft ring-1 ring-line"
            }`}
          >
            {SUB_LABELS[item]}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        {sub === "commits" &&
          rows(
            snapshot.commits.map((commit) => ({
              key: commit.sha,
              primary: commit.message,
              secondary: `${commit.sha.slice(0, 7)} · ${commit.authorLogin ?? commit.authorName ?? "bilinmiyor"} · ${commit.branch ?? ""}`,
              url: commit.htmlUrl,
            })),
          )}

        {sub === "pulls" &&
          rows(
            snapshot.pullRequests.map((pr) => ({
              key: String(pr.number),
              primary: `#${pr.number} ${pr.title}`,
              secondary: [
                pr.state === "open" ? "Açık" : "Kapalı",
                pr.draft ? "Taslak" : null,
                pr.merged ? "Merge edildi" : null,
                pr.authorLogin,
              ]
                .filter(Boolean)
                .join(" · "),
              url: pr.htmlUrl,
            })),
          )}

        {sub === "issues" &&
          rows(
            snapshot.issues.map((issue) => ({
              key: String(issue.number),
              primary: `#${issue.number} ${issue.title}`,
              secondary: [
                issue.state === "open" ? "Açık" : "Kapalı",
                issue.labels.join(", "),
                issue.assigneeLogin,
              ]
                .filter(Boolean)
                .join(" · "),
              url: issue.htmlUrl,
            })),
          )}

        {sub === "actions" &&
          (snapshot.workflowRuns.length === 0 ? (
            empty()
          ) : (
            <ul className="space-y-2">
              {snapshot.workflowRuns.map((run) => {
                const failed = run.conclusion === "failure";
                return (
                  <li
                    key={run.runId}
                    className={`rounded-card border p-3.5 ${failed ? "border-danger/40 bg-danger-soft" : "border-line bg-surface"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                          {failed ? (
                            <AlertTriangle size={14} aria-hidden="true" className="text-danger" />
                          ) : (
                            <CheckCircle2 size={14} aria-hidden="true" className="text-ok" />
                          )}
                          {run.name}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-soft">
                          {run.branch ?? "—"} · {run.headSha?.slice(0, 7) ?? "—"} ·{" "}
                          <span className={failed ? "font-medium text-danger" : ""}>
                            {run.conclusion ?? run.status}
                          </span>
                        </p>
                        <p className="text-xs text-ink-soft">
                          {run.startedAt ?? "—"} → {run.completedAt ?? "—"}
                        </p>
                      </div>
                      {run.htmlUrl && externalLink(run.htmlUrl, run.name)}
                    </div>
                  </li>
                );
              })}
            </ul>
          ))}

        {sub === "branches" &&
          rows(
            snapshot.branches.map((branch) => ({
              key: branch.name,
              primary: branch.name,
              secondary: [
                branch.isDefault ? "Varsayılan" : null,
                branch.protectedBranch ? "Korumalı" : null,
                branch.commitSha.slice(0, 7),
              ]
                .filter(Boolean)
                .join(" · "),
              url: null,
            })),
          )}

        {sub === "releases" &&
          rows(
            snapshot.releases.map((release) => ({
              key: release.tagName,
              primary: `${release.tagName}${release.name ? ` — ${release.name}` : ""}`,
              secondary: [
                release.publishedAt ?? "yayınlanmadı",
                release.draft ? "Taslak" : null,
                release.prerelease ? "Ön sürüm" : null,
              ]
                .filter(Boolean)
                .join(" · "),
              url: release.htmlUrl,
            })),
          )}
      </div>
    </div>
  );
}

function empty() {
  return (
    <p className="rounded-card border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-ink-soft">
      Kayıt yok.
    </p>
  );
}

function externalLink(url: string, label: string) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} — GitHub'da aç`}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-line text-ink-soft transition-colors hover:border-brand hover:text-brand"
    >
      <ExternalLink size={15} aria-hidden="true" />
    </a>
  );
}

function rows(
  items: { key: string; primary: string; secondary: string; url: string | null }[],
) {
  if (items.length === 0) return empty();

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item.key}
          className="flex items-start justify-between gap-3 rounded-card border border-line bg-surface p-3.5"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{item.primary}</p>
            <p className="mt-0.5 text-xs text-ink-soft">{item.secondary}</p>
          </div>
          {item.url ? externalLink(item.url, item.primary) : null}
        </li>
      ))}
    </ul>
  );
}
