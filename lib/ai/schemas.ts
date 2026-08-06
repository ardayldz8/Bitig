import { z } from "zod";

/** Tüm AI çıktıları veritabanına yazılmadan ÖNCE bu şemalarla doğrulanır. */

export const projectSummarySchema = z.object({
  overview: z.string().min(1).max(2000),
  technologies: z.array(z.string().min(1).max(60)).max(25),
  modules: z.array(z.string().min(1).max(120)).max(25),
  activeWork: z.array(z.string().min(1).max(200)).max(15),
  risks: z.array(z.string().min(1).max(300)).max(15),
  recommendations: z.array(z.string().min(1).max(300)).max(15),
});
export type ProjectSummary = z.infer<typeof projectSummarySchema>;

export const featureDraftSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(4000),
  acceptanceCriteria: z.array(z.string().min(1).max(300)).max(15),
  priority: z.enum(["low", "medium", "high", "critical"]),
  suggestedLabels: z.array(z.string().min(1).max(40)).max(10),
  relatedFiles: z.array(z.string().min(1).max(200)).max(15),
});
export type FeatureDraft = z.infer<typeof featureDraftSchema>;

export const githubIssueDraftSchema = z.object({
  title: z.string().min(1).max(250),
  body: z.string().min(1).max(20_000),
  labels: z.array(z.string().min(1).max(40)).max(10),
});
export type GitHubIssueDraft = z.infer<typeof githubIssueDraftSchema>;

export const roadmapDraftSchema = z.object({
  phases: z
    .array(
      z.object({
        title: z.string().min(1).max(150),
        goal: z.string().min(1).max(500),
        items: z
          .array(
            z.object({
              title: z.string().min(1).max(200),
              reason: z.string().min(1).max(400),
              priority: z.enum(["low", "medium", "high", "critical"]),
            }),
          )
          .max(15),
      }),
    )
    .min(1)
    .max(6),
});
export type RoadmapDraft = z.infer<typeof roadmapDraftSchema>;

export const releaseNotesDraftSchema = z.object({
  version: z.string().max(40).nullable(),
  markdown: z.string().min(1).max(20_000),
  highlights: z.array(z.string().min(1).max(300)).max(15),
  /** Kaynağı doğrulanamayan hiçbir madde eklenmemeli. */
  sourceCount: z.number().int().min(0),
});
export type ReleaseNotesDraft = z.infer<typeof releaseNotesDraftSchema>;

// --- OpenRouter'a gönderilen JSON Schema'lar (structured output) ---

const stringArray = { type: "array", items: { type: "string" } } as const;

export const PROJECT_SUMMARY_JSON_SCHEMA = {
  name: "project_summary",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["overview", "technologies", "modules", "activeWork", "risks", "recommendations"],
    properties: {
      overview: { type: "string" },
      technologies: stringArray,
      modules: stringArray,
      activeWork: stringArray,
      risks: stringArray,
      recommendations: stringArray,
    },
  },
} as const;

export const FEATURE_DRAFT_JSON_SCHEMA = {
  name: "feature_draft",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "title",
      "description",
      "acceptanceCriteria",
      "priority",
      "suggestedLabels",
      "relatedFiles",
    ],
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      acceptanceCriteria: stringArray,
      priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
      suggestedLabels: stringArray,
      relatedFiles: stringArray,
    },
  },
} as const;

export const ISSUE_DRAFT_JSON_SCHEMA = {
  name: "github_issue_draft",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["title", "body", "labels"],
    properties: {
      title: { type: "string" },
      body: { type: "string" },
      labels: stringArray,
    },
  },
} as const;

export const ROADMAP_JSON_SCHEMA = {
  name: "roadmap_draft",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["phases"],
    properties: {
      phases: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "goal", "items"],
          properties: {
            title: { type: "string" },
            goal: { type: "string" },
            items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["title", "reason", "priority"],
                properties: {
                  title: { type: "string" },
                  reason: { type: "string" },
                  priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

export const RELEASE_NOTES_JSON_SCHEMA = {
  name: "release_notes_draft",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["version", "markdown", "highlights", "sourceCount"],
    properties: {
      version: { type: ["string", "null"] },
      markdown: { type: "string" },
      highlights: stringArray,
      sourceCount: { type: "number" },
    },
  },
} as const;

/** AI'nın kullanabileceği araçlar — model GitHub API'ye DOĞRUDAN erişemez. */
export const projectAssistantTools = [
  "get_project_overview",
  "get_repository_summary",
  "get_recent_commits",
  "get_open_pull_requests",
  "get_open_issues",
  "get_workflow_status",
  "get_project_features",
  "get_project_notes",
  "get_project_tasks",
  "get_recent_activity",
  "create_feature_draft",
  "create_issue_draft",
  "create_roadmap_draft",
  "create_release_notes_draft",
] as const;

export type ProjectAssistantTool = (typeof projectAssistantTools)[number];
