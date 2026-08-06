import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeCommit,
  normalizeIssue,
  normalizePullRequest,
  normalizeRelease,
  normalizeWorkflowRun,
} from "@/lib/github/normalize";

export type WebhookUpdate = {
  repositoryFullName: string | null;
  activityType: string;
  title: string;
  description: string | null;
  externalUrl: string | null;
  occurredAt: string;
  /** Normalize edilmiş kaydı önbelleğe yazar (opsiyonel). */
  persist?: (admin: SupabaseClient, projectId: string) => Promise<void>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function repoFullName(payload: Record<string, unknown> | null): string | null {
  const repo = asRecord(payload?.repository);
  const fullName = repo?.full_name;
  return typeof fullName === "string" ? fullName : null;
}

const nowIso = () => new Date().toISOString();

/**
 * Webhook event'ini uygulama karşılığına çevirir.
 * Tüm payload saklanmaz; yalnızca gerekli alanlar normalize edilir.
 * Saf fonksiyondur — birim testlerle doğrulanır.
 */
export function buildWebhookUpdate(event: string, payload: unknown): WebhookUpdate | null {
  const body = asRecord(payload);
  if (!body) return null;

  const fullName = repoFullName(body);

  switch (event) {
    case "push": {
      const commits = Array.isArray(body.commits) ? body.commits : [];
      const branch =
        typeof body.ref === "string" ? body.ref.replace("refs/heads/", "") : null;

      return {
        repositoryFullName: fullName,
        activityType: "push",
        title: `${commits.length} commit pushlandı`,
        description: branch ? `Branch: ${branch}` : null,
        externalUrl: typeof body.compare === "string" ? body.compare : null,
        occurredAt: nowIso(),
        persist: async (admin, projectId) => {
          const rows = commits
            .map((commit) => normalizeCommit(commit, branch))
            .filter((commit): commit is NonNullable<typeof commit> => commit !== null)
            .map((commit) => ({
              project_id: projectId,
              sha: commit.sha,
              message: commit.message,
              author_name: commit.authorName,
              author_login: commit.authorLogin,
              branch: commit.branch,
              html_url: commit.htmlUrl,
              committed_at: commit.committedAt,
            }));
          if (rows.length > 0) {
            await admin.from("github_commits").upsert(rows, { onConflict: "project_id,sha" });
          }
        },
      };
    }

    case "pull_request": {
      const pr = normalizePullRequest(body.pull_request);
      if (!pr) return null;
      const action = typeof body.action === "string" ? body.action : "updated";

      return {
        repositoryFullName: fullName,
        activityType: "pull_request",
        title: `PR #${pr.number} ${pr.merged ? "merge edildi" : action}`,
        description: pr.title,
        externalUrl: pr.htmlUrl,
        occurredAt: nowIso(),
        persist: async (admin, projectId) => {
          await admin.from("github_pull_requests").upsert(
            {
              project_id: projectId,
              number: pr.number,
              title: pr.title,
              state: pr.state,
              merged: pr.merged,
              draft: pr.draft,
              author_login: pr.authorLogin,
              html_url: pr.htmlUrl,
              created_at: pr.createdAt,
            },
            { onConflict: "project_id,number" },
          );
        },
      };
    }

    case "issues": {
      const issue = normalizeIssue(body.issue);
      if (!issue) return null;
      const action = typeof body.action === "string" ? body.action : "updated";

      return {
        repositoryFullName: fullName,
        activityType: "issue",
        title: `Issue #${issue.number} ${action}`,
        description: issue.title,
        externalUrl: issue.htmlUrl,
        occurredAt: nowIso(),
        persist: async (admin, projectId) => {
          await admin.from("github_issues").upsert(
            {
              project_id: projectId,
              number: issue.number,
              title: issue.title,
              state: issue.state,
              labels: issue.labels,
              assignee_login: issue.assigneeLogin,
              html_url: issue.htmlUrl,
              created_at: issue.createdAt,
            },
            { onConflict: "project_id,number" },
          );
        },
      };
    }

    case "issue_comment": {
      const issue = asRecord(body.issue);
      const number = typeof issue?.number === "number" ? issue.number : null;
      if (number === null) return null;

      return {
        repositoryFullName: fullName,
        activityType: "issue_comment",
        title: `Issue #${number} yorumlandı`,
        description: typeof issue?.title === "string" ? issue.title : null,
        externalUrl: typeof asRecord(body.comment)?.html_url === "string"
          ? (asRecord(body.comment)?.html_url as string)
          : null,
        occurredAt: nowIso(),
      };
    }

    case "workflow_run": {
      const run = normalizeWorkflowRun(body.workflow_run);
      if (!run) return null;

      return {
        repositoryFullName: fullName,
        activityType: "workflow_run",
        title: `CI: ${run.name} — ${run.conclusion ?? run.status}`,
        description: run.branch ? `Branch: ${run.branch}` : null,
        externalUrl: run.htmlUrl,
        occurredAt: nowIso(),
        persist: async (admin, projectId) => {
          await admin.from("github_workflow_runs").upsert(
            {
              project_id: projectId,
              run_id: run.runId,
              name: run.name,
              branch: run.branch,
              head_sha: run.headSha,
              status: run.status,
              conclusion: run.conclusion,
              started_at: run.startedAt,
              completed_at: run.completedAt,
              html_url: run.htmlUrl,
            },
            { onConflict: "project_id,run_id" },
          );
        },
      };
    }

    case "check_run": {
      const check = asRecord(body.check_run);
      const name = typeof check?.name === "string" ? check.name : "check";
      const conclusion = typeof check?.conclusion === "string" ? check.conclusion : "beklemede";

      return {
        repositoryFullName: fullName,
        activityType: "check_run",
        title: `Kontrol: ${name} — ${conclusion}`,
        description: typeof check?.head_sha === "string" ? `SHA: ${check.head_sha.slice(0, 7)}` : null,
        externalUrl: typeof check?.html_url === "string" ? check.html_url : null,
        occurredAt: nowIso(),
      };
    }

    case "release": {
      const release = normalizeRelease(body.release);
      if (!release) return null;

      return {
        repositoryFullName: fullName,
        activityType: "release",
        title: `Release ${release.tagName} yayınlandı`,
        description: release.name,
        externalUrl: release.htmlUrl,
        occurredAt: nowIso(),
        persist: async (admin, projectId) => {
          await admin.from("github_releases").upsert(
            {
              project_id: projectId,
              tag_name: release.tagName,
              name: release.name,
              published_at: release.publishedAt,
              draft: release.draft,
              prerelease: release.prerelease,
              html_url: release.htmlUrl,
            },
            { onConflict: "project_id,tag_name" },
          );
        },
      };
    }

    case "repository": {
      if (!fullName) return null;
      const action = typeof body.action === "string" ? body.action : "güncellendi";

      return {
        repositoryFullName: fullName,
        activityType: "repository",
        title: `Repository ${action}`,
        description: fullName,
        externalUrl: null,
        occurredAt: nowIso(),
      };
    }

    default:
      return null;
  }
}
