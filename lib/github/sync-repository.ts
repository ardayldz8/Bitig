import {
  decodeContent,
  githubRequest,
  githubRequestSafe,
} from "@/lib/github/client";
import {
  MAX_TREE_FILES,
  TECH_DETECTION_FILES,
  detectTechnologies,
  normalizeBranch,
  normalizeCommit,
  normalizeIssue,
  normalizePullRequest,
  normalizeRelease,
  normalizeRepository,
  normalizeTree,
  normalizeWorkflowRun,
} from "@/lib/github/normalize";
import { filterSecretPaths } from "@/lib/ai/security";
import type { RepositorySnapshot } from "@/types/github";

const RECENT_LIMIT = 20;

/**
 * Repository'nin sınırlı, normalize edilmiş anlık görüntüsünü alır.
 *
 * Tüm repo içeriği ÇEKİLMEZ:
 *  - dosya ağacı MAX_TREE_FILES ile sınırlı
 *  - node_modules/.next/dist/build/vendor atlanır
 *  - binary dosyalar okunmaz
 *  - yalnızca teknoloji tespiti için gereken dosyalar indirilir
 *  - secret içerebilecek yollar filtrelenir
 */
export async function syncRepository(
  installationId: number,
  fullName: string,
): Promise<RepositorySnapshot> {
  const repoPayload = await githubRequest<unknown>(installationId, `/repos/${fullName}`);
  const repository = normalizeRepository(repoPayload);
  if (!repository) throw new Error("repository_normalize_failed");

  const branch = repository.defaultBranch;

  const [
    commitsPayload,
    pullsPayload,
    issuesPayload,
    runsPayload,
    releasesPayload,
    branchesPayload,
    languagesPayload,
    readmePayload,
    treePayload,
  ] = await Promise.all([
    githubRequestSafe<unknown[]>(installationId, `/repos/${fullName}/commits?per_page=${RECENT_LIMIT}&sha=${encodeURIComponent(branch)}`),
    githubRequestSafe<unknown[]>(installationId, `/repos/${fullName}/pulls?state=open&per_page=${RECENT_LIMIT}`),
    githubRequestSafe<unknown[]>(installationId, `/repos/${fullName}/issues?state=open&per_page=${RECENT_LIMIT}`),
    githubRequestSafe<{ workflow_runs?: unknown[] }>(installationId, `/repos/${fullName}/actions/runs?per_page=10`),
    githubRequestSafe<unknown[]>(installationId, `/repos/${fullName}/releases?per_page=5`),
    githubRequestSafe<unknown[]>(installationId, `/repos/${fullName}/branches?per_page=50`),
    githubRequestSafe<Record<string, number>>(installationId, `/repos/${fullName}/languages`),
    githubRequestSafe<unknown>(installationId, `/repos/${fullName}/readme`),
    githubRequestSafe<unknown>(installationId, `/repos/${fullName}/git/trees/${encodeURIComponent(branch)}?recursive=1`),
  ]);

  const branches = (branchesPayload ?? [])
    .map((item) => normalizeBranch(item, branch))
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const files = filterSecretPaths(normalizeTree(treePayload, fullName, branch));

  // Teknoloji tespiti: yalnızca bilinen birkaç dosya indirilir
  const techFiles: Record<string, string> = {};
  const presentTechFiles = TECH_DETECTION_FILES.filter((name) =>
    files.some((file) => file.path === name),
  ).slice(0, 6);

  await Promise.all(
    presentTechFiles.map(async (name) => {
      const payload = await githubRequestSafe<unknown>(
        installationId,
        `/repos/${fullName}/contents/${encodeURIComponent(name)}?ref=${encodeURIComponent(branch)}`,
      );
      const content = decodeContent(payload);
      if (content) techFiles[name] = content;
    }),
  );

  const readme = decodeContent(readmePayload);

  return {
    repository: {
      ...repository,
      languages: languagesPayload ?? {},
      branchCount: branches.length,
      readme: readme ? readme.slice(0, 20_000) : null,
    },
    commits: (commitsPayload ?? [])
      .map((item) => normalizeCommit(item, branch))
      .filter((item): item is NonNullable<typeof item> => item !== null),
    pullRequests: (pullsPayload ?? [])
      .map(normalizePullRequest)
      .filter((item): item is NonNullable<typeof item> => item !== null),
    issues: (issuesPayload ?? [])
      .map(normalizeIssue)
      .filter((item): item is NonNullable<typeof item> => item !== null),
    workflowRuns: (runsPayload?.workflow_runs ?? [])
      .map(normalizeWorkflowRun)
      .filter((item): item is NonNullable<typeof item> => item !== null),
    releases: (releasesPayload ?? [])
      .map(normalizeRelease)
      .filter((item): item is NonNullable<typeof item> => item !== null),
    branches,
    files: files.slice(0, MAX_TREE_FILES),
    syncedAt: new Date().toISOString(),
  };
}

/** Tespit edilen teknolojileri repo dosyalarından çıkarır. */
export function technologiesFromFiles(files: Record<string, string>): string[] {
  return detectTechnologies(files);
}
