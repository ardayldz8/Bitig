import { z } from "zod";
import { computeHealth } from "@/lib/projects/health";
import { computeMetrics } from "@/lib/projects/metrics";
import { filterSecretPaths, redactSecrets, wrapUntrusted } from "@/lib/ai/security";

/**
 * AI'ya gönderilecek proje bağlamı.
 *
 * Model GitHub API'ye DOĞRUDAN erişemez. Backend hangi verinin modele
 * gideceğine burada karar verir; miktar sınırlanır, secret'lar filtrelenir.
 */

const commitSchema = z.object({
  sha: z.string().max(64),
  message: z.string().max(300),
  authorLogin: z.string().max(80).nullable().default(null),
  committedAt: z.string().max(40),
});

const pullRequestSchema = z.object({
  number: z.number().int(),
  title: z.string().max(300),
  state: z.string().max(20),
  draft: z.boolean().default(false),
  merged: z.boolean().default(false),
  createdAt: z.string().max(40),
});

const issueSchema = z.object({
  number: z.number().int(),
  title: z.string().max(300),
  state: z.string().max(20),
  labels: z.array(z.string().max(40)).max(12).default([]),
  createdAt: z.string().max(40),
});

const workflowSchema = z.object({
  name: z.string().max(120),
  status: z.string().max(40),
  conclusion: z.string().max(40).nullable().default(null),
  branch: z.string().max(120).nullable().default(null),
  startedAt: z.string().max(40).nullable().default(null),
});

const featureSchema = z.object({
  title: z.string().max(200),
  description: z.string().max(2000).nullable().default(null),
  status: z.string().max(30),
  priority: z.string().max(20),
});

const noteSchema = z.object({
  title: z.string().max(200),
  content: z.string().max(4000),
});

const taskSchema = z.object({
  title: z.string().max(200),
  completed: z.boolean(),
  priority: z.string().max(20),
});

export const projectContextSchema = z.object({
  project: z.object({
    name: z.string().max(120),
    description: z.string().max(2000).nullable().default(null),
    status: z.string().max(20),
    technologies: z.array(z.string().max(60)).max(25).default([]),
    githubFullName: z.string().max(160).nullable().default(null),
  }),
  repository: z
    .object({
      readme: z.string().max(20_000).nullable().default(null),
      languages: z.record(z.string(), z.number()).default({}),
      defaultBranch: z.string().max(120).default("main"),
      files: z
        .array(z.object({ path: z.string().max(300), important: z.boolean().default(false) }))
        .max(300)
        .default([]),
    })
    .nullable()
    .default(null),
  commits: z.array(commitSchema).max(30).default([]),
  pullRequests: z.array(pullRequestSchema).max(30).default([]),
  issues: z.array(issueSchema).max(30).default([]),
  workflowRuns: z.array(workflowSchema).max(15).default([]),
  features: z.array(featureSchema).max(60).default([]),
  notes: z.array(noteSchema).max(30).default([]),
  tasks: z.array(taskSchema).max(60).default([]),
});

export type ProjectContext = z.infer<typeof projectContextSchema>;

/** Deterministik metrik + sağlık hesabı — AI bunları yorumlar, üretmez. */
export function contextMetrics(context: ProjectContext) {
  const metrics = computeMetrics({
    snapshot: {
      repository: {
        id: "",
        repositoryId: 0,
        fullName: context.project.githubFullName ?? "",
        name: context.project.name,
        description: null,
        isPrivate: false,
        defaultBranch: context.repository?.defaultBranch ?? "main",
        htmlUrl: "",
        language: null,
        languages: {},
        branchCount: null,
        readme: null,
        updatedAt: new Date(0).toISOString(),
      },
      commits: context.commits.map((commit) => ({
        sha: commit.sha,
        message: commit.message,
        authorName: null,
        authorLogin: commit.authorLogin,
        committedAt: commit.committedAt,
        branch: null,
        htmlUrl: "",
      })),
      pullRequests: context.pullRequests.map((pr) => ({
        number: pr.number,
        title: pr.title,
        state: pr.state === "closed" ? "closed" : "open",
        merged: pr.merged,
        draft: pr.draft,
        authorLogin: null,
        createdAt: pr.createdAt,
        reviewState: null,
        checksState: null,
        htmlUrl: "",
      })),
      issues: context.issues.map((issue) => ({
        number: issue.number,
        title: issue.title,
        state: issue.state === "closed" ? "closed" : "open",
        labels: issue.labels,
        assigneeLogin: null,
        createdAt: issue.createdAt,
        htmlUrl: "",
      })),
      workflowRuns: context.workflowRuns.map((run, index) => ({
        runId: index,
        name: run.name,
        branch: run.branch,
        headSha: null,
        status: run.status,
        conclusion: run.conclusion,
        startedAt: run.startedAt,
        completedAt: null,
        htmlUrl: "",
      })),
      releases: [],
      branches: [],
      files: [],
      syncedAt: new Date().toISOString(),
    },
    features: context.features.map((feature, index) => ({
      id: String(index),
      projectId: "",
      title: feature.title,
      description: feature.description,
      status: feature.status as never,
      priority: feature.priority as never,
      acceptanceCriteria: [],
      githubIssueNumber: null,
      githubIssueUrl: null,
      targetDate: null,
      completedAt: null,
      position: index,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    tasks: context.tasks.map((task, index) => ({
      id: String(index),
      projectId: "",
      title: task.title,
      description: null,
      completed: task.completed,
      priority: task.priority as never,
      relatedFeatureId: null,
      githubIssueNumber: null,
      dueDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
  });

  return { metrics, health: computeHealth(metrics) };
}

/**
 * Modele gönderilecek metni oluşturur.
 * Güvenilmeyen içerikler (README, issue başlıkları, commit mesajları)
 * <proje_verisi> etiketiyle sarılır ve secret'lardan arındırılır.
 */
export function buildContextPrompt(context: ProjectContext): string {
  const { metrics, health } = contextMetrics(context);
  const parts: string[] = [];

  parts.push(
    "PROJE (Bitig kaynaklı, güvenilir):",
    JSON.stringify({
      name: context.project.name,
      description: context.project.description,
      status: context.project.status,
      technologies: context.project.technologies,
      repository: context.project.githubFullName,
    }),
  );

  parts.push(
    "",
    "ÖLÇÜLEN METRİKLER (deterministik, senin hesaplaman gerekmez):",
    JSON.stringify(metrics),
    `SAĞLIK: ${health.level} (${health.score}/100). Nedenler: ${health.reasons.join(" ") || "yok"}`,
  );

  if (context.repository?.readme) {
    parts.push("", wrapUntrusted("README", context.repository.readme, 6000));
  }

  if (context.repository) {
    const files = filterSecretPaths(context.repository.files);
    const important = files.filter((file) => file.important).map((file) => file.path);
    parts.push(
      "",
      `DİLLER: ${JSON.stringify(context.repository.languages)}`,
      `ÖNEMLİ DOSYALAR: ${important.slice(0, 30).join(", ") || "yok"}`,
      `TOPLAM LİSTELENEN DOSYA: ${files.length}`,
    );
  }

  if (context.commits.length > 0) {
    parts.push(
      "",
      wrapUntrusted(
        "commit_mesajlari",
        context.commits
          .slice(0, 20)
          .map((c) => `${c.sha.slice(0, 7)} ${c.message} (${c.committedAt})`)
          .join("\n"),
        3000,
      ),
    );
  }

  if (context.pullRequests.length > 0) {
    parts.push(
      "",
      wrapUntrusted(
        "acik_pull_requestler",
        context.pullRequests.map((pr) => `#${pr.number} ${pr.title}`).join("\n"),
        2000,
      ),
    );
  }

  if (context.issues.length > 0) {
    parts.push(
      "",
      wrapUntrusted(
        "acik_issuelar",
        context.issues
          .map((issue) => `#${issue.number} ${issue.title} [${issue.labels.join(",")}]`)
          .join("\n"),
        2000,
      ),
    );
  }

  if (context.workflowRuns.length > 0) {
    parts.push(
      "",
      `SON CI SONUÇLARI: ${context.workflowRuns
        .slice(0, 5)
        .map((run) => `${run.name}=${run.conclusion ?? run.status}`)
        .join(", ")}`,
    );
  }

  if (context.features.length > 0) {
    parts.push(
      "",
      "BITIG ÖZELLİKLERİ (kullanıcının kendi planı):",
      redactSecrets(
        context.features
          .map((f) => `- [${f.status}/${f.priority}] ${f.title}`)
          .join("\n"),
      ).slice(0, 3000),
    );
  }

  if (context.notes.length > 0) {
    parts.push(
      "",
      wrapUntrusted(
        "bitig_notlari",
        context.notes.map((n) => `## ${n.title}\n${n.content}`).join("\n\n"),
        4000,
      ),
    );
  }

  return parts.join("\n");
}
