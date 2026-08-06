import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  FeaturePriority,
  FeatureStatus,
  Project,
  ProjectActivity,
  ProjectActivitySource,
  ProjectFeature,
  ProjectNote,
  ProjectStatus,
  ProjectTask,
} from "@/types/project";

/**
 * Supabase satırları snake_case, uygulama tipleri camelCase.
 * Dönüşüm tek yerde tutulur; her iki yön de burada.
 */

type Row = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown): string | null => (typeof v === "string" ? v : null);
const numOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const bool = (v: unknown): boolean => v === true;
const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((item): item is string => typeof item === "string") : [];

export function rowToProject(row: Row): Project {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    name: str(row.name),
    description: strOrNull(row.description),
    status: (str(row.status) || "active") as ProjectStatus,
    repositoryId: strOrNull(row.repository_id),
    githubFullName: strOrNull(row.github_full_name),
    githubDefaultBranch: strOrNull(row.github_default_branch),
    technologies: strArray(row.technologies),
    lastSyncedAt: strOrNull(row.last_synced_at),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  };
}

export function rowToFeature(row: Row): ProjectFeature {
  return {
    id: str(row.id),
    projectId: str(row.project_id),
    title: str(row.title),
    description: strOrNull(row.description),
    status: (str(row.status) || "planned") as FeatureStatus,
    priority: (str(row.priority) || "medium") as FeaturePriority,
    acceptanceCriteria: strArray(row.acceptance_criteria),
    githubIssueNumber: numOrNull(row.github_issue_number),
    githubIssueUrl: strOrNull(row.github_issue_url),
    targetDate: strOrNull(row.target_date),
    completedAt: strOrNull(row.completed_at),
    position: numOrNull(row.position) ?? 0,
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  };
}

export function rowToNote(row: Row): ProjectNote {
  return {
    id: str(row.id),
    projectId: str(row.project_id),
    title: str(row.title),
    content: str(row.content),
    relatedFeatureId: strOrNull(row.related_feature_id),
    tags: strArray(row.tags),
    pinned: bool(row.pinned),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  };
}

export function rowToTask(row: Row): ProjectTask {
  return {
    id: str(row.id),
    projectId: str(row.project_id),
    title: str(row.title),
    description: strOrNull(row.description),
    completed: bool(row.completed),
    priority: (str(row.priority) || "medium") as FeaturePriority,
    relatedFeatureId: strOrNull(row.related_feature_id),
    githubIssueNumber: numOrNull(row.github_issue_number),
    dueDate: strOrNull(row.due_date),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  };
}

export function rowToActivity(row: Row): ProjectActivity {
  return {
    id: str(row.id),
    projectId: str(row.project_id),
    source: (str(row.source) || "bitig") as ProjectActivitySource,
    type: str(row.type),
    title: str(row.title),
    description: strOrNull(row.description),
    externalUrl: strOrNull(row.external_url),
    occurredAt: str(row.occurred_at),
  };
}

export type ProjectsBundle = {
  projects: Project[];
  features: ProjectFeature[];
  notes: ProjectNote[];
  tasks: ProjectTask[];
  activities: ProjectActivity[];
};

/**
 * Kullanıcının tüm proje verisini çeker.
 * RLS sayesinde yalnızca kendi kayıtları döner — ayrıca user_id filtresi
 * eklemeye gerek yoktur, ama projects için açıkça filtreleriz (index kullanımı).
 */
export async function fetchProjectsBundle(
  client: SupabaseClient,
  userId: string,
): Promise<ProjectsBundle> {
  const { data: projectRows, error } = await client
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const projects = (projectRows ?? []).map(rowToProject);
  if (projects.length === 0) {
    return { projects, features: [], notes: [], tasks: [], activities: [] };
  }

  const ids = projects.map((project) => project.id);

  const [features, notes, tasks, activities] = await Promise.all([
    client.from("project_features").select("*").in("project_id", ids).order("position"),
    client.from("project_notes").select("*").in("project_id", ids),
    client.from("project_tasks").select("*").in("project_id", ids),
    client
      .from("project_activities")
      .select("*")
      .in("project_id", ids)
      .order("occurred_at", { ascending: false })
      .limit(300),
  ]);

  // Alt sorgular sessizce boş dönmesin: hata yüzünden "0 özellik" göstermek,
  // gerçekten 0 özellik olmasıyla aynı şey değil.
  for (const result of [features, notes, tasks, activities]) {
    if (result.error) throw new Error(result.error.message);
  }

  return {
    projects,
    features: (features.data ?? []).map(rowToFeature),
    notes: (notes.data ?? []).map(rowToNote),
    tasks: (tasks.data ?? []).map(rowToTask),
    activities: (activities.data ?? []).map(rowToActivity),
  };
}
