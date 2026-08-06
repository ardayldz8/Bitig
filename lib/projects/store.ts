import type {
  Project,
  ProjectActivity,
  ProjectFeature,
  ProjectNote,
  ProjectTask,
} from "@/types/project";

/**
 * Supabase yapılandırılmadığında kullanılan yerel depolama.
 * Şekiller veritabanı ile birebir aynıdır; Supabase açıldığında veri taşınabilir.
 */
export const PROJECTS_KEY = "bitig.projects.v1";

export type ProjectsState = {
  projects: Project[];
  features: ProjectFeature[];
  notes: ProjectNote[];
  tasks: ProjectTask[];
  activities: ProjectActivity[];
};

export const EMPTY_STATE: ProjectsState = {
  projects: [],
  features: [],
  notes: [],
  tasks: [],
  activities: [],
};

function isArrayOf<T>(value: unknown, guard: (item: unknown) => item is T): T[] {
  return Array.isArray(value) ? value.filter(guard) : [];
}

function hasId(value: unknown): value is { id: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string"
  );
}

const isProject = (v: unknown): v is Project =>
  hasId(v) && typeof (v as Project).name === "string";
const isFeature = (v: unknown): v is ProjectFeature =>
  hasId(v) && typeof (v as ProjectFeature).title === "string";
const isNote = (v: unknown): v is ProjectNote =>
  hasId(v) && typeof (v as ProjectNote).title === "string";
const isTask = (v: unknown): v is ProjectTask =>
  hasId(v) && typeof (v as ProjectTask).title === "string";
const isActivity = (v: unknown): v is ProjectActivity =>
  hasId(v) && typeof (v as ProjectActivity).title === "string";

export function readProjectsState(): ProjectsState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROJECTS_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const state = parsed as Record<string, unknown>;

    return {
      projects: isArrayOf(state.projects, isProject),
      features: isArrayOf(state.features, isFeature),
      notes: isArrayOf(state.notes, isNote),
      tasks: isArrayOf(state.tasks, isTask),
      activities: isArrayOf(state.activities, isActivity),
    };
  } catch {
    return null;
  }
}


export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** İlk açılışta gösterilen örnek proje (referans tasarımdaki gibi). */
