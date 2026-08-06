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

export function writeProjectsState(state: ProjectsState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(state));
  } catch {
    // Kota dolu / erişilemez — uygulama çalışmaya devam eder
  }
}

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** İlk açılışta gösterilen örnek proje (referans tasarımdaki gibi). */
export function createSeedState(): ProjectsState {
  const now = new Date().toISOString();
  const projectId = "bitig-demo";

  const project: Project = {
    id: projectId,
    userId: "local",
    name: "Bitig",
    description: "Kişisel verimlilik uygulaması",
    status: "active",
    repositoryId: null,
    githubFullName: null,
    githubDefaultBranch: null,
    technologies: ["Next.js", "TypeScript", "Tailwind CSS"],
    lastSyncedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const featureSpecs: [string, string, ProjectFeature["status"], ProjectFeature["priority"]][] = [
    ["Manga Takip", "Okuduğum mangaları takip etme özelliği", "completed", "medium"],
    ["Kalori Takip", "Yemek fotoğrafı ile kalori hesaplama", "completed", "high"],
    ["Dizi / Film Takip", "İzlediğim dizi ve filmleri takip etme", "completed", "medium"],
    ["Proje Takip", "Yazılım projelerimi takip etme", "in_progress", "high"],
    ["Alışkanlık Takip", "Günlük alışkanlıklarımı takip etme", "planned", "medium"],
    ["Finans Takip", "Gelir/gider takibi", "planned", "low"],
    ["Notlar", "Not alma ve düzenleme", "planned", "low"],
    ["Hatırlatıcılar", "Hatırlatıcı ve bildirim sistemi", "on_hold", "medium"],
  ];

  const features: ProjectFeature[] = featureSpecs.map(
    ([title, description, status, priority], index) => ({
      id: `${projectId}-f${index + 1}`,
      projectId,
      title,
      description,
      status,
      priority,
      acceptanceCriteria: [],
      githubIssueNumber: null,
      githubIssueUrl: null,
      targetDate: null,
      completedAt: status === "completed" ? now : null,
      position: index,
      createdAt: now,
      updatedAt: now,
    }),
  );

  const notes: ProjectNote[] = [
    {
      id: `${projectId}-n1`,
      projectId,
      title: "v1.2.0 Planı",
      content:
        "- Alışkanlık takip özelliği eklenecek\n- Hatırlatıcı sistemi geliştirilecek\n- Performans iyileştirmeleri yapılacak",
      relatedFeatureId: null,
      tags: ["plan"],
      pinned: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${projectId}-n2`,
      projectId,
      title: "Veritabanı Geçişi",
      content:
        "LocalStorage yerine PostgreSQL + Prisma geçişi yapılmalı.\nKullanıcı verilerinin güvenli migrasyonu için plan oluşturulacak.",
      relatedFeatureId: null,
      tags: ["altyapı"],
      pinned: false,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const activities: ProjectActivity[] = [
    {
      id: `${projectId}-a1`,
      projectId,
      source: "bitig",
      type: "project_created",
      title: "Proje oluşturuldu",
      description: "Bitig projesi eklendi",
      externalUrl: null,
      occurredAt: now,
    },
  ];

  return { projects: [project], features, notes, tasks: [], activities };
}
