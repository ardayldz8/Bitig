import type {
  GitHubBranch,
  GitHubCommit,
  GitHubFileNode,
  GitHubIssue,
  GitHubPullRequest,
  GitHubRelease,
  GitHubRepository,
  GitHubWorkflowRun,
} from "@/types/github";

/**
 * GitHub payload'larını normalize eder.
 *
 * TÜM payload saklanmaz — yalnızca gerekli alanlar alınır, gereksiz kişisel veri
 * (e-posta, avatar, tam profil vb.) dışarıda bırakılır.
 * Saf fonksiyonlardır; birim testlerle doğrulanır.
 */

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

export function normalizeRepository(payload: unknown): GitHubRepository | null {
  const repo = record(payload);
  if (!repo) return null;

  const id = num(repo.id);
  const fullName = str(repo.full_name);
  const name = str(repo.name);
  if (id === null || !fullName || !name) return null;

  return {
    id: fullName,
    repositoryId: id,
    fullName,
    name,
    description: str(repo.description),
    isPrivate: repo.private === true,
    defaultBranch: str(repo.default_branch) ?? "main",
    htmlUrl: str(repo.html_url) ?? `https://github.com/${fullName}`,
    language: str(repo.language),
    languages: {},
    branchCount: null,
    readme: null,
    updatedAt: str(repo.updated_at) ?? new Date(0).toISOString(),
  };
}

export function normalizeCommit(payload: unknown, branch: string | null): GitHubCommit | null {
  const item = record(payload);
  if (!item) return null;

  // REST /commits biçimi: { sha, commit: { message, author }, author: { login }, html_url }
  const sha = str(item.sha) ?? str(item.id);
  if (!sha) return null;

  const commit = record(item.commit);
  const commitAuthor = record(commit?.author);
  const ghAuthor = record(item.author);

  const message = str(commit?.message) ?? str(item.message) ?? "";

  return {
    sha,
    // Yalnızca ilk satır — commit gövdesi gereksiz yere saklanmaz
    message: message.split("\n")[0].slice(0, 300),
    authorName: str(commitAuthor?.name) ?? str(record(item.author)?.name),
    authorLogin: str(ghAuthor?.login) ?? str(record(item.author)?.username),
    committedAt: str(commitAuthor?.date) ?? str(item.timestamp) ?? new Date(0).toISOString(),
    branch,
    htmlUrl: str(item.html_url) ?? str(item.url) ?? `https://github.com/commit/${sha}`,
  };
}

export function normalizePullRequest(payload: unknown): GitHubPullRequest | null {
  const pr = record(payload);
  if (!pr) return null;

  const number = num(pr.number);
  const title = str(pr.title);
  if (number === null || !title) return null;

  return {
    number,
    title: title.slice(0, 300),
    state: pr.state === "closed" ? "closed" : "open",
    merged: pr.merged === true || str(pr.merged_at) !== null,
    draft: pr.draft === true,
    authorLogin: str(record(pr.user)?.login),
    createdAt: str(pr.created_at) ?? new Date(0).toISOString(),
    reviewState: null,
    checksState: null,
    htmlUrl: str(pr.html_url) ?? "",
  };
}

export function normalizeIssue(payload: unknown): GitHubIssue | null {
  const issue = record(payload);
  if (!issue) return null;

  // GitHub issue endpoint'i PR'ları da döndürür; ayıkla
  if (record(issue.pull_request) !== null) return null;

  const number = num(issue.number);
  const title = str(issue.title);
  if (number === null || !title) return null;

  const labels = Array.isArray(issue.labels)
    ? issue.labels
        .map((label) => (typeof label === "string" ? label : str(record(label)?.name)))
        .filter((label): label is string => label !== null)
        .slice(0, 12)
    : [];

  return {
    number,
    title: title.slice(0, 300),
    state: issue.state === "closed" ? "closed" : "open",
    labels,
    assigneeLogin: str(record(issue.assignee)?.login),
    createdAt: str(issue.created_at) ?? new Date(0).toISOString(),
    htmlUrl: str(issue.html_url) ?? "",
  };
}

export function normalizeWorkflowRun(payload: unknown): GitHubWorkflowRun | null {
  const run = record(payload);
  if (!run) return null;

  const runId = num(run.id);
  if (runId === null) return null;

  return {
    runId,
    name: str(run.name) ?? str(run.workflow_name) ?? "workflow",
    branch: str(run.head_branch),
    headSha: str(run.head_sha),
    status: str(run.status) ?? "unknown",
    conclusion: str(run.conclusion),
    startedAt: str(run.run_started_at) ?? str(run.created_at),
    completedAt: str(run.updated_at),
    htmlUrl: str(run.html_url) ?? "",
  };
}

export function normalizeRelease(payload: unknown): GitHubRelease | null {
  const release = record(payload);
  if (!release) return null;

  const tagName = str(release.tag_name);
  if (!tagName) return null;

  return {
    tagName,
    name: str(release.name),
    publishedAt: str(release.published_at),
    draft: release.draft === true,
    prerelease: release.prerelease === true,
    htmlUrl: str(release.html_url) ?? "",
  };
}

export function normalizeBranch(payload: unknown, defaultBranch: string): GitHubBranch | null {
  const branch = record(payload);
  if (!branch) return null;

  const name = str(branch.name);
  if (!name) return null;

  return {
    name,
    isDefault: name === defaultBranch,
    protectedBranch: branch.protected === true,
    commitSha: str(record(branch.commit)?.sha) ?? "",
  };
}

/** AI analizinde anlamlı kabul edilen dosyalar. */
const IMPORTANT_FILES = new Set([
  "README.md",
  "readme.md",
  "package.json",
  "go.mod",
  "Cargo.toml",
  "Dockerfile",
  "docker-compose.yml",
  "pyproject.toml",
  "requirements.txt",
  "composer.json",
  "Gemfile",
  "tsconfig.json",
]);

/** Teknoloji tespiti için okunacak dosyalar (tüm repo taranmaz). */
export const TECH_DETECTION_FILES = [
  "package.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "package-lock.json",
  "go.mod",
  "Cargo.toml",
  "pyproject.toml",
  "requirements.txt",
  "composer.json",
  "Gemfile",
  "Dockerfile",
  "docker-compose.yml",
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "vite.config.js",
  "vite.config.ts",
  "tsconfig.json",
] as const;

const SKIPPED_DIRS = ["node_modules/", ".next/", "dist/", "build/", "vendor/", ".git/"];
export const MAX_TREE_FILES = 300;
export const MAX_FILE_BYTES = 100_000;

export function shouldSkipPath(path: string): boolean {
  return SKIPPED_DIRS.some((dir) => path === dir.slice(0, -1) || path.startsWith(dir));
}

export function normalizeTree(payload: unknown, fullName: string, branch: string): GitHubFileNode[] {
  const tree = record(payload);
  const entries = tree?.tree;
  if (!Array.isArray(entries)) return [];

  const nodes: GitHubFileNode[] = [];
  for (const raw of entries) {
    const entry = record(raw);
    if (!entry) continue;

    const path = str(entry.path);
    if (!path || shouldSkipPath(path)) continue;

    const type = entry.type === "tree" ? "dir" : "file";
    const size = num(entry.size);
    if (type === "file" && size !== null && size > MAX_FILE_BYTES) continue;

    nodes.push({
      path,
      type,
      size,
      htmlUrl: `https://github.com/${fullName}/blob/${branch}/${path}`,
      important: IMPORTANT_FILES.has(path) || IMPORTANT_FILES.has(path.split("/").pop() ?? ""),
    });

    if (nodes.length >= MAX_TREE_FILES) break;
  }

  // Önemli dosyalar önce
  return nodes.sort((a, b) => Number(b.important) - Number(a.important));
}

/** package.json / go.mod gibi dosyalardan teknoloji listesi çıkarır. */
export function detectTechnologies(files: Record<string, string>): string[] {
  const found = new Set<string>();

  const packageJson = files["package.json"];
  if (packageJson) {
    try {
      const parsed: unknown = JSON.parse(packageJson);
      const pkg = record(parsed);
      const deps = {
        ...(record(pkg?.dependencies) ?? {}),
        ...(record(pkg?.devDependencies) ?? {}),
      };
      const known: Record<string, string> = {
        next: "Next.js",
        react: "React",
        vue: "Vue",
        svelte: "Svelte",
        typescript: "TypeScript",
        tailwindcss: "Tailwind CSS",
        express: "Express",
        "@supabase/supabase-js": "Supabase",
        prisma: "Prisma",
        vitest: "Vitest",
        jest: "Jest",
      };
      for (const [dep, label] of Object.entries(known)) {
        if (dep in deps) found.add(label);
      }
    } catch {
      // bozuk package.json — yok say
    }
  }

  if (files["go.mod"]) found.add("Go");
  if (files["Cargo.toml"]) found.add("Rust");
  if (files["pyproject.toml"] || files["requirements.txt"]) found.add("Python");
  if (files["composer.json"]) found.add("PHP");
  if (files["Gemfile"]) found.add("Ruby");
  if (files["Dockerfile"] || files["docker-compose.yml"]) found.add("Docker");
  if (files["tsconfig.json"]) found.add("TypeScript");

  return [...found].sort();
}
