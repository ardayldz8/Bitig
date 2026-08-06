"use client";

import { Activity, GitCommitHorizontal, ShieldAlert } from "lucide-react";
import { HEALTH_LABELS, type ProjectHealth } from "@/lib/projects/health";
import type { ProjectMetrics } from "@/lib/projects/metrics";
import type { RepositorySnapshot } from "@/types/github";
import {
  FEATURE_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  type Project,
  type ProjectFeature,
} from "@/types/project";
import type { ProjectSummary } from "@/lib/ai/schemas";

const HEALTH_STYLE: Record<ProjectHealth["level"], string> = {
  healthy: "bg-ok-soft text-ok",
  attention: "bg-amber-100 text-amber-700",
  at_risk: "bg-danger-soft text-danger",
};

type OverviewProps = {
  project: Project;
  features: ProjectFeature[];
  metrics: ProjectMetrics;
  health: ProjectHealth;
  snapshot: RepositorySnapshot | null;
  summary: ProjectSummary | null;
};

export default function ProjectOverview({
  project,
  features,
  metrics,
  health,
  snapshot,
  summary,
}: OverviewProps) {
  const inProgress = features.filter((f) => f.status === "in_progress");
  const lastCommit = snapshot?.commits[0] ?? null;
  const lastRelease = snapshot?.releases[0] ?? null;

  return (
    <div className="space-y-4">
      <section className="rounded-card border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ink">Proje özeti</h3>
            <p className="mt-1 text-sm text-ink-soft">
              {project.description ?? "Açıklama eklenmemiş."}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${HEALTH_STYLE[health.level]}`}
          >
            <ShieldAlert size={13} aria-hidden="true" />
            {HEALTH_LABELS[health.level]} · {health.score}/100
          </span>
        </div>

        {project.technologies.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {project.technologies.map((tech) => (
              <li
                key={tech}
                className="rounded-full bg-brand-soft px-2.5 py-1 text-xs text-brand-strong"
              >
                {tech}
              </li>
            ))}
          </ul>
        )}

        {health.reasons.length > 0 && (
          <div className="mt-4 rounded-xl bg-canvas p-3">
            <p className="text-xs font-medium text-ink">
              Sağlık puanını etkileyen ölçülen veriler
            </p>
            <ul className="mt-1.5 space-y-1 text-xs text-ink-soft">
              {health.reasons.map((reason) => (
                <li key={reason}>• {reason}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Durum" value={PROJECT_STATUS_LABELS[project.status]} />
        <Metric label="Açık PR" value={String(metrics.openPullRequests)} />
        <Metric label="Açık Issue" value={String(metrics.openIssues)} />
        <Metric
          label="Son CI"
          value={metrics.lastWorkflowConclusion ?? "—"}
          warn={metrics.failingWorkflows}
        />
        <Metric
          label="Özellik"
          value={`${metrics.completedFeatures}/${metrics.totalFeatures}`}
        />
        <Metric label="Açık görev" value={String(metrics.openTasks)} />
        <Metric
          label="Son commit"
          value={
            metrics.daysSinceLastCommit === null
              ? "—"
              : `${metrics.daysSinceLastCommit} gün önce`
          }
        />
        <Metric label="Son release" value={lastRelease?.tagName ?? "—"} />
      </section>

      {lastCommit && (
        <section className="rounded-card border border-line bg-surface p-5">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
            <GitCommitHorizontal size={16} aria-hidden="true" className="text-brand" />
            Son commit
          </h3>
          <p className="text-sm text-ink">{lastCommit.message}</p>
          <p className="mt-1 text-xs text-ink-soft">
            {lastCommit.sha.slice(0, 7)} · {lastCommit.authorLogin ?? lastCommit.authorName ?? "bilinmiyor"}
          </p>
        </section>
      )}

      {inProgress.length > 0 && (
        <section className="rounded-card border border-line bg-surface p-5">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
            <Activity size={16} aria-hidden="true" className="text-brand" />
            Devam eden özellikler
          </h3>
          <ul className="space-y-1.5">
            {inProgress.map((feature) => (
              <li key={feature.id} className="text-sm text-ink">
                • {feature.title}{" "}
                <span className="text-xs text-ink-soft">
                  ({FEATURE_STATUS_LABELS[feature.status]})
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-card border border-line bg-surface p-5">
        <h3 className="text-sm font-semibold text-ink">AI proje özeti</h3>
        {summary ? (
          <div className="mt-2 space-y-3 text-sm">
            <p className="text-ink-soft">{summary.overview}</p>
            {summary.risks.length > 0 && (
              <div>
                <p className="text-xs font-medium text-ink">Riskler</p>
                <ul className="mt-1 space-y-1 text-xs text-ink-soft">
                  {summary.risks.map((risk) => (
                    <li key={risk}>• {risk}</li>
                  ))}
                </ul>
              </div>
            )}
            {summary.recommendations.length > 0 && (
              <div>
                <p className="text-xs font-medium text-ink">Öneriler</p>
                <ul className="mt-1 space-y-1 text-xs text-ink-soft">
                  {summary.recommendations.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink-soft">
            Henüz özet oluşturulmadı. “AI Asistan” sekmesinden proje özeti
            oluşturabilirsin.
          </p>
        )}
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-3.5">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${warn ? "text-danger" : "text-ink"}`}>
        {value}
      </p>
    </div>
  );
}
