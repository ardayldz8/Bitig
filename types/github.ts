export type GitHubInstallation = {
  id: string;
  userId: string;
  installationId: number;
  accountLogin: string;
  accountType: string;
  createdAt: string;
};

export type GitHubRepository = {
  id: string;
  repositoryId: number;
  fullName: string;
  name: string;
  description: string | null;
  isPrivate: boolean;
  defaultBranch: string;
  htmlUrl: string;
  language: string | null;
  languages: Record<string, number>;
  branchCount: number | null;
  readme: string | null;
  updatedAt: string;
};

export type GitHubCommit = {
  sha: string;
  message: string;
  authorName: string | null;
  authorLogin: string | null;
  committedAt: string;
  branch: string | null;
  htmlUrl: string;
};

export type GitHubPullRequest = {
  number: number;
  title: string;
  state: "open" | "closed";
  merged: boolean;
  draft: boolean;
  authorLogin: string | null;
  createdAt: string;
  reviewState: string | null;
  checksState: string | null;
  htmlUrl: string;
};

export type GitHubIssue = {
  number: number;
  title: string;
  state: "open" | "closed";
  labels: string[];
  assigneeLogin: string | null;
  createdAt: string;
  htmlUrl: string;
};

export type GitHubWorkflowRun = {
  runId: number;
  name: string;
  branch: string | null;
  headSha: string | null;
  status: string;
  conclusion: string | null;
  startedAt: string | null;
  completedAt: string | null;
  htmlUrl: string;
};

export type GitHubRelease = {
  tagName: string;
  name: string | null;
  publishedAt: string | null;
  draft: boolean;
  prerelease: boolean;
  htmlUrl: string;
};

export type GitHubBranch = {
  name: string;
  isDefault: boolean;
  protectedBranch: boolean;
  commitSha: string;
};

export type GitHubFileNode = {
  path: string;
  type: "file" | "dir";
  size: number | null;
  htmlUrl: string;
  /** AI analizi için anlamlı kabul edilen dosya. */
  important: boolean;
};

/** Bir projeye ait, önbelleklenmiş GitHub anlık görüntüsü. */
export type RepositorySnapshot = {
  repository: GitHubRepository;
  commits: GitHubCommit[];
  pullRequests: GitHubPullRequest[];
  issues: GitHubIssue[];
  workflowRuns: GitHubWorkflowRun[];
  releases: GitHubRelease[];
  branches: GitHubBranch[];
  files: GitHubFileNode[];
  syncedAt: string;
};

export const GITHUB_WEBHOOK_EVENTS = [
  "push",
  "pull_request",
  "issues",
  "issue_comment",
  "workflow_run",
  "check_run",
  "release",
  "repository",
] as const;

export type GitHubWebhookEvent = (typeof GITHUB_WEBHOOK_EVENTS)[number];

export function isSupportedWebhookEvent(value: string): value is GitHubWebhookEvent {
  return (GITHUB_WEBHOOK_EVENTS as readonly string[]).includes(value);
}
