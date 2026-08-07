import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  GitHubCommit,
  GitHubIssue,
  GitHubPullRequest,
  GitHubRelease,
  GitHubRepository,
  GitHubWorkflowRun,
  RepositorySnapshot,
} from "@/types/github";

/**
 * GitHub anlık görüntüsünün kalıcı hâli.
 *
 * Senkronizasyon sonucu daha önce yalnızca React state'inde duruyordu: sayfa
 * yenilenince PR sayısı, son commit ve CI durumu kayboluyor, ana sayfa
 * istatistikleri hep boş görünüyordu. Tablolar baştan beri vardı ama hiçbir
 * şey yazmıyordu.
 *
 * Dosya ağacı ve branch listesi SAKLANMAZ: ikisi de büyük ve hızla eskiyen
 * veri, tekrar senkronizasyonda zaten yeniden çekiliyor.
 */

type Row = Record<string, unknown>;

const num = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const str = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const strList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

/** Tek bir sorgunun hatası tüm senkronizasyonu düşürsün — yarım veri yazılmasın. */
function assertOk(result: { error: { message: string } | null }, what: string): void {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
}

export async function saveSnapshot(
  client: SupabaseClient,
  projectId: string,
  snapshot: RepositorySnapshot,
): Promise<void> {
  const repo = snapshot.repository;

  // Her senkronizasyon o projenin GitHub verisini baştan yazar. Artımlı
  // birleştirme yapılmıyor: kapanan PR ya da silinen issue listede kalırdı.
  for (const table of [
    "github_commits",
    "github_pull_requests",
    "github_issues",
    "github_workflow_runs",
    "github_releases",
    "github_repositories",
  ]) {
    assertOk(await client.from(table).delete().eq("project_id", projectId), `${table} temizlenemedi`);
  }

  assertOk(
    await client.from("github_repositories").insert({
      project_id: projectId,
      repository_id: repo.repositoryId,
      full_name: repo.fullName,
      name: repo.name,
      description: repo.description,
      is_private: repo.isPrivate,
      default_branch: repo.defaultBranch,
      html_url: repo.htmlUrl,
      language: repo.language,
      languages: repo.languages,
      branch_count: snapshot.branches.length || repo.branchCount,
      readme: repo.readme,
      updated_at: repo.updatedAt,
    }),
    "repository yazılamadı",
  );

  if (snapshot.commits.length > 0) {
    assertOk(
      await client.from("github_commits").insert(
        snapshot.commits.map((commit) => ({
          project_id: projectId,
          sha: commit.sha,
          message: commit.message,
          author_name: commit.authorName,
          author_login: commit.authorLogin,
          branch: commit.branch,
          html_url: commit.htmlUrl,
          committed_at: commit.committedAt,
        })),
      ),
      "commit'ler yazılamadı",
    );
  }

  if (snapshot.pullRequests.length > 0) {
    assertOk(
      await client.from("github_pull_requests").insert(
        snapshot.pullRequests.map((pr) => ({
          project_id: projectId,
          number: pr.number,
          title: pr.title,
          state: pr.state,
          merged: pr.merged,
          draft: pr.draft,
          author_login: pr.authorLogin,
          review_state: pr.reviewState,
          checks_state: pr.checksState,
          html_url: pr.htmlUrl,
          created_at: pr.createdAt,
        })),
      ),
      "pull request'ler yazılamadı",
    );
  }

  if (snapshot.issues.length > 0) {
    assertOk(
      await client.from("github_issues").insert(
        snapshot.issues.map((issue) => ({
          project_id: projectId,
          number: issue.number,
          title: issue.title,
          state: issue.state,
          labels: issue.labels,
          assignee_login: issue.assigneeLogin,
          html_url: issue.htmlUrl,
          created_at: issue.createdAt,
        })),
      ),
      "issue'lar yazılamadı",
    );
  }

  if (snapshot.workflowRuns.length > 0) {
    assertOk(
      await client.from("github_workflow_runs").insert(
        snapshot.workflowRuns.map((run) => ({
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
        })),
      ),
      "workflow çalışmaları yazılamadı",
    );
  }

  if (snapshot.releases.length > 0) {
    assertOk(
      await client.from("github_releases").insert(
        snapshot.releases.map((release) => ({
          project_id: projectId,
          tag_name: release.tagName,
          name: release.name,
          published_at: release.publishedAt,
          draft: release.draft,
          prerelease: release.prerelease,
          html_url: release.htmlUrl,
        })),
      ),
      "release'ler yazılamadı",
    );
  }

  assertOk(
    await client
      .from("projects")
      .update({
        last_synced_at: snapshot.syncedAt,
        github_default_branch: repo.defaultBranch,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId),
    "proje güncellenemedi",
  );

  assertOk(
    await client
      .from("github_sync_states")
      .upsert(
        {
          project_id: projectId,
          last_synced_at: snapshot.syncedAt,
          last_status: "success",
          last_error: null,
        },
        { onConflict: "project_id" },
      ),
    "senkronizasyon durumu yazılamadı",
  );
}

function toRepository(row: Row): GitHubRepository | null {
  const fullName = str(row.full_name);
  if (!fullName) return null;

  return {
    id: str(row.id) ?? fullName,
    repositoryId: num(row.repository_id) ?? 0,
    fullName,
    name: str(row.name) ?? fullName,
    description: str(row.description),
    isPrivate: row.is_private === true,
    defaultBranch: str(row.default_branch) ?? "main",
    htmlUrl: str(row.html_url) ?? `https://github.com/${fullName}`,
    language: str(row.language),
    languages:
      typeof row.languages === "object" && row.languages !== null
        ? (row.languages as Record<string, number>)
        : {},
    branchCount: num(row.branch_count),
    readme: str(row.readme),
    updatedAt: str(row.updated_at) ?? new Date(0).toISOString(),
  };
}

/**
 * Kaydedilmiş anlık görüntüleri okur.
 *
 * `files` ve `branches` boş döner — saklanmıyorlar. Arayüz bu durumda
 * "senkronize et" demeli, "dosya yok" değil.
 */
export async function loadSnapshots(
  client: SupabaseClient,
  projectIds: string[],
): Promise<Record<string, RepositorySnapshot>> {
  if (projectIds.length === 0) return {};

  const [repos, commits, pulls, issues, runs, releases] = await Promise.all([
    client.from("github_repositories").select("*").in("project_id", projectIds),
    client
      .from("github_commits")
      .select("*")
      .in("project_id", projectIds)
      .order("committed_at", { ascending: false }),
    client.from("github_pull_requests").select("*").in("project_id", projectIds),
    client.from("github_issues").select("*").in("project_id", projectIds),
    client
      .from("github_workflow_runs")
      .select("*")
      .in("project_id", projectIds)
      .order("started_at", { ascending: false }),
    client.from("github_releases").select("*").in("project_id", projectIds),
  ]);

  for (const [result, what] of [
    [repos, "repository"],
    [commits, "commit"],
    [pulls, "pull request"],
    [issues, "issue"],
    [runs, "workflow"],
    [releases, "release"],
  ] as const) {
    assertOk(result, `${what} okunamadı`);
  }

  const byProject = <T>(rows: unknown, map: (row: Row) => T | null) => {
    const grouped = new Map<string, T[]>();
    for (const raw of Array.isArray(rows) ? (rows as Row[]) : []) {
      const projectId = str(raw.project_id);
      if (!projectId) continue;
      const item = map(raw);
      if (item === null) continue;
      const list = grouped.get(projectId) ?? [];
      list.push(item);
      grouped.set(projectId, list);
    }
    return grouped;
  };

  const commitMap = byProject<GitHubCommit>(commits.data, (row) => {
    const sha = str(row.sha);
    return sha
      ? {
          sha,
          message: str(row.message) ?? "",
          authorName: str(row.author_name),
          authorLogin: str(row.author_login),
          committedAt: str(row.committed_at) ?? new Date(0).toISOString(),
          branch: str(row.branch),
          htmlUrl: str(row.html_url) ?? "",
        }
      : null;
  });

  const pullMap = byProject<GitHubPullRequest>(pulls.data, (row) => {
    const number = num(row.number);
    return number === null
      ? null
      : {
          number,
          title: str(row.title) ?? "",
          state: row.state === "closed" ? "closed" : "open",
          merged: row.merged === true,
          draft: row.draft === true,
          authorLogin: str(row.author_login),
          createdAt: str(row.created_at) ?? new Date(0).toISOString(),
          reviewState: str(row.review_state),
          checksState: str(row.checks_state),
          htmlUrl: str(row.html_url) ?? "",
        };
  });

  const issueMap = byProject<GitHubIssue>(issues.data, (row) => {
    const number = num(row.number);
    return number === null
      ? null
      : {
          number,
          title: str(row.title) ?? "",
          state: row.state === "closed" ? "closed" : "open",
          labels: strList(row.labels),
          assigneeLogin: str(row.assignee_login),
          createdAt: str(row.created_at) ?? new Date(0).toISOString(),
          htmlUrl: str(row.html_url) ?? "",
        };
  });

  const runMap = byProject<GitHubWorkflowRun>(runs.data, (row) => {
    const runId = num(row.run_id);
    return runId === null
      ? null
      : {
          runId,
          name: str(row.name) ?? "",
          branch: str(row.branch),
          headSha: str(row.head_sha),
          status: str(row.status) ?? "completed",
          conclusion: str(row.conclusion),
          startedAt: str(row.started_at),
          completedAt: str(row.completed_at),
          htmlUrl: str(row.html_url) ?? "",
        };
  });

  const releaseMap = byProject<GitHubRelease>(releases.data, (row) => {
    const tagName = str(row.tag_name);
    return tagName
      ? {
          tagName,
          name: str(row.name),
          publishedAt: str(row.published_at),
          draft: row.draft === true,
          prerelease: row.prerelease === true,
          htmlUrl: str(row.html_url) ?? "",
        }
      : null;
  });

  const output: Record<string, RepositorySnapshot> = {};
  for (const raw of Array.isArray(repos.data) ? (repos.data as Row[]) : []) {
    const projectId = str(raw.project_id);
    const repository = toRepository(raw);
    if (!projectId || !repository) continue;

    output[projectId] = {
      repository,
      commits: commitMap.get(projectId) ?? [],
      pullRequests: pullMap.get(projectId) ?? [],
      issues: issueMap.get(projectId) ?? [],
      workflowRuns: runMap.get(projectId) ?? [],
      releases: releaseMap.get(projectId) ?? [],
      branches: [],
      files: [],
      syncedAt: str(raw.updated_at) ?? new Date(0).toISOString(),
    };
  }

  return output;
}
