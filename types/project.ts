export type ProjectStatus = "active" | "on_hold" | "completed" | "archived";

export type FeatureStatus =
  | "planned"
  | "in_progress"
  | "completed"
  | "blocked"
  | "on_hold";

export type FeaturePriority = "low" | "medium" | "high" | "critical";

export type Project = {
  id: string;
  userId: string;

  name: string;
  description: string | null;

  status: ProjectStatus;

  repositoryId: string | null;
  githubFullName: string | null;
  githubDefaultBranch: string | null;

  technologies: string[];

  lastSyncedAt: string | null;

  createdAt: string;
  updatedAt: string;
};

export type ProjectFeature = {
  id: string;
  projectId: string;

  title: string;
  description: string | null;

  status: FeatureStatus;
  priority: FeaturePriority;

  acceptanceCriteria: string[];

  githubIssueNumber: number | null;
  githubIssueUrl: string | null;

  targetDate: string | null;
  completedAt: string | null;

  position: number;

  createdAt: string;
  updatedAt: string;
};

export type ProjectNote = {
  id: string;
  projectId: string;

  title: string;
  content: string;

  relatedFeatureId: string | null;

  tags: string[];

  pinned: boolean;

  createdAt: string;
  updatedAt: string;
};

export type ProjectTask = {
  id: string;
  projectId: string;

  title: string;
  description: string | null;

  completed: boolean;
  priority: FeaturePriority;

  relatedFeatureId: string | null;
  githubIssueNumber: number | null;

  dueDate: string | null;

  createdAt: string;
  updatedAt: string;
};

export type ProjectActivitySource = "github" | "bitig" | "ai";

export type ProjectActivity = {
  id: string;
  projectId: string;

  source: ProjectActivitySource;
  type: string;

  title: string;
  description: string | null;

  externalUrl: string | null;

  occurredAt: string;
};

// --- Etiketler ---

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Aktif",
  on_hold: "Beklemede",
  completed: "Tamamlandı",
  archived: "Arşivlendi",
};

export const FEATURE_STATUS_LABELS: Record<FeatureStatus, string> = {
  planned: "Planlandı",
  in_progress: "Devam Ediyor",
  completed: "Tamamlandı",
  blocked: "Engellendi",
  on_hold: "Beklemede",
};

export const PRIORITY_LABELS: Record<FeaturePriority, string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
  critical: "Kritik",
};

export const PROJECT_TABS = [
  "overview",
  "features",
  "notes",
  "tasks",
  "github",
  "activity",
  "files",
  "ai",
] as const;

export type ProjectTab = (typeof PROJECT_TABS)[number];

export const TAB_LABELS: Record<ProjectTab, string> = {
  overview: "Genel Bakış",
  features: "Özellikler",
  notes: "Notlar",
  tasks: "Görevler",
  github: "GitHub",
  activity: "Aktivite",
  files: "Dosyalar",
  ai: "AI Asistan",
};

export function isProjectTab(value: string): value is ProjectTab {
  return (PROJECT_TABS as readonly string[]).includes(value);
}
