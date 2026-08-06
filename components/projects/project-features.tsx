"use client";

import { Check, ExternalLink, GitPullRequestArrow, Pencil, Plus, Trash2 } from "lucide-react";
import {
  FEATURE_STATUS_LABELS,
  PRIORITY_LABELS,
  type FeaturePriority,
  type FeatureStatus,
  type ProjectFeature,
} from "@/types/project";

const STATUS_STYLE: Record<FeatureStatus, string> = {
  planned: "bg-amber-100 text-amber-700",
  in_progress: "bg-brand-soft text-brand-strong",
  completed: "bg-ok-soft text-ok",
  blocked: "bg-danger-soft text-danger",
  on_hold: "bg-canvas text-ink-soft ring-1 ring-line",
};

const PRIORITY_STYLE: Record<FeaturePriority, string> = {
  low: "text-ink-soft",
  medium: "text-ink",
  high: "text-amber-700",
  critical: "text-danger",
};

type FeaturesProps = {
  features: ProjectFeature[];
  onAdd: () => void;
  onEdit: (feature: ProjectFeature) => void;
  onDelete: (feature: ProjectFeature) => void;
  onComplete: (feature: ProjectFeature) => void;
  onConvertToIssue: (feature: ProjectFeature) => void;
};

export default function ProjectFeatures({
  features,
  onAdd,
  onEdit,
  onDelete,
  onComplete,
  onConvertToIssue,
}: FeaturesProps) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">
          Özellikler <span className="text-ink-soft">{features.length}</span>
        </h3>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-strong"
        >
          <Plus size={16} aria-hidden="true" />
          Özellik ekle
        </button>
      </div>

      {features.length === 0 ? (
        <p className="rounded-card border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-ink-soft">
          Henüz özellik eklenmemiş.
        </p>
      ) : (
        <ul className="space-y-2">
          {features.map((feature) => (
            <li
              key={feature.id}
              className="rounded-card border border-line bg-surface p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{feature.title}</p>
                  {feature.description && (
                    <p className="mt-0.5 text-sm text-ink-soft">{feature.description}</p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                    <span
                      className={`rounded-full px-2.5 py-1 font-medium ${STATUS_STYLE[feature.status]}`}
                    >
                      {FEATURE_STATUS_LABELS[feature.status]}
                    </span>
                    <span className={PRIORITY_STYLE[feature.priority]}>
                      Öncelik: {PRIORITY_LABELS[feature.priority]}
                    </span>
                    {feature.targetDate && (
                      <span className="text-ink-soft">Hedef: {feature.targetDate}</span>
                    )}
                    {feature.githubIssueUrl && (
                      <a
                        href={feature.githubIssueUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-brand hover:underline"
                      >
                        Issue #{feature.githubIssueNumber}
                        <ExternalLink size={11} aria-hidden="true" />
                      </a>
                    )}
                  </div>

                  {feature.acceptanceCriteria.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-ink-soft">
                      {feature.acceptanceCriteria.map((criterion) => (
                        <li key={criterion}>✓ {criterion}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {feature.status !== "completed" && (
                    <button
                      type="button"
                      onClick={() => onComplete(feature)}
                      aria-label={`${feature.title} özelliğini tamamlandı işaretle`}
                      className="grid h-11 w-11 place-items-center rounded-lg border border-line text-ink-soft transition-colors hover:border-ok hover:text-ok"
                    >
                      <Check size={16} aria-hidden="true" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onConvertToIssue(feature)}
                    aria-label={`${feature.title} için GitHub issue taslağı oluştur`}
                    className="grid h-11 w-11 place-items-center rounded-lg border border-line text-ink-soft transition-colors hover:border-brand hover:text-brand"
                  >
                    <GitPullRequestArrow size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(feature)}
                    aria-label={`${feature.title} özelliğini düzenle`}
                    className="grid h-11 w-11 place-items-center rounded-lg border border-line text-ink-soft transition-colors hover:border-brand hover:text-brand"
                  >
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(feature)}
                    aria-label={`${feature.title} özelliğini sil`}
                    className="grid h-11 w-11 place-items-center rounded-lg border border-line text-ink-soft transition-colors hover:border-danger hover:text-danger"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
