import type { RepositorySnapshot } from "@/types/github";
import type { ProjectFeature, ProjectTask } from "@/types/project";

export type ProjectMetrics = {
  openPullRequests: number;
  openIssues: number;
  /** 30 günden eski açık issue sayısı. */
  staleIssues: number;
  failingWorkflows: boolean;
  lastWorkflowConclusion: string | null;
  daysSinceLastCommit: number | null;
  totalFeatures: number;
  completedFeatures: number;
  blockedFeatures: number;
  highPriorityPending: number;
  openTasks: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_ISSUE_DAYS = 30;

function daysBetween(from: string, now: number): number | null {
  const time = new Date(from).getTime();
  if (Number.isNaN(time)) return null;
  return Math.floor((now - time) / DAY_MS);
}

/**
 * Deterministik proje metrikleri.
 * Sağlık değerlendirmesi ÖNCE bu gerçek sayılardan hesaplanır; AI yalnızca
 * bu sayıları yorumlar, kendi başına sağlık puanı uydurmaz.
 */
export function computeMetrics(input: {
  snapshot: RepositorySnapshot | null;
  features: ProjectFeature[];
  tasks: ProjectTask[];
  now?: number;
}): ProjectMetrics {
  const now = input.now ?? Date.now();
  const snapshot = input.snapshot;

  const openPullRequests =
    snapshot?.pullRequests.filter((pr) => pr.state === "open").length ?? 0;

  const openIssuesList = snapshot?.issues.filter((issue) => issue.state === "open") ?? [];
  const staleIssues = openIssuesList.filter((issue) => {
    const age = daysBetween(issue.createdAt, now);
    return age !== null && age > STALE_ISSUE_DAYS;
  }).length;

  // En son çalışan workflow'un sonucu belirleyicidir
  const latestRun = snapshot?.workflowRuns
    .slice()
    .sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""))[0];

  const lastCommit = snapshot?.commits[0];
  const daysSinceLastCommit = lastCommit
    ? daysBetween(lastCommit.committedAt, now)
    : null;

  return {
    openPullRequests,
    openIssues: openIssuesList.length,
    staleIssues,
    failingWorkflows: latestRun?.conclusion === "failure",
    lastWorkflowConclusion: latestRun?.conclusion ?? null,
    daysSinceLastCommit,
    totalFeatures: input.features.length,
    completedFeatures: input.features.filter((f) => f.status === "completed").length,
    blockedFeatures: input.features.filter((f) => f.status === "blocked").length,
    highPriorityPending: input.features.filter(
      (f) =>
        f.status !== "completed" && (f.priority === "high" || f.priority === "critical"),
    ).length,
    openTasks: input.tasks.filter((task) => !task.completed).length,
  };
}
