"use client";

import { useCallback, useEffect, useState } from "react";
import {
  EMPTY_STATE,
  createId,
  createSeedState,
  readProjectsState,
  writeProjectsState,
  type ProjectsState,
} from "@/lib/projects/store";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type {
  Project,
  ProjectActivity,
  ProjectFeature,
  ProjectNote,
  ProjectTask,
} from "@/types/project";
import type {
  FeatureInput,
  NoteInput,
  ProjectInput,
  TaskInput,
} from "@/lib/projects/validation";

export type ProjectsApi = ProjectsState & {
  hydrated: boolean;
  /** Supabase yapılandırılmadıysa veriler yalnızca bu tarayıcıda tutulur. */
  localMode: boolean;

  createProject: (input: ProjectInput) => Project;
  updateProject: (id: string, input: ProjectInput) => void;
  deleteProject: (id: string) => void;

  createFeature: (projectId: string, input: FeatureInput) => ProjectFeature;
  updateFeature: (id: string, input: FeatureInput) => void;
  patchFeature: (id: string, patch: Partial<ProjectFeature>) => void;
  deleteFeature: (id: string) => void;

  createNote: (projectId: string, input: NoteInput) => ProjectNote;
  updateNote: (id: string, input: NoteInput) => void;
  patchNote: (id: string, patch: Partial<ProjectNote>) => void;
  deleteNote: (id: string) => void;

  createTask: (projectId: string, input: TaskInput) => ProjectTask;
  patchTask: (id: string, patch: Partial<ProjectTask>) => void;
  deleteTask: (id: string) => void;

  addActivity: (activity: Omit<ProjectActivity, "id">) => void;
};

export function useProjects(): ProjectsApi {
  const [state, setState] = useState<ProjectsState>(EMPTY_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [localMode, setLocalMode] = useState(true);

  // Veriler yalnızca mount sonrası okunur → hydration uyuşmazlığı olmaz
  useEffect(() => {
    setLocalMode(!isSupabaseConfigured());
    setState(readProjectsState() ?? createSeedState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeProjectsState(state);
  }, [state, hydrated]);

  const now = () => new Date().toISOString();

  const logActivity = useCallback(
    (projectId: string, type: string, title: string, description: string | null = null) => {
      const entry: ProjectActivity = {
        id: createId(),
        projectId,
        source: "bitig",
        type,
        title,
        description,
        externalUrl: null,
        occurredAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        activities: [entry, ...prev.activities].slice(0, 300),
      }));
    },
    [],
  );

  const createProject = useCallback((input: ProjectInput): Project => {
    const timestamp = new Date().toISOString();
    const project: Project = {
      id: createId(),
      userId: "local",
      name: input.name,
      description: input.description,
      status: input.status,
      repositoryId: null,
      githubFullName: input.githubFullName,
      githubDefaultBranch: null,
      technologies: input.technologies,
      lastSyncedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const activity: ProjectActivity = {
      id: createId(),
      projectId: project.id,
      source: "bitig",
      type: "project_created",
      title: "Proje oluşturuldu",
      description: project.name,
      externalUrl: null,
      occurredAt: timestamp,
    };
    setState((prev) => ({
      ...prev,
      projects: [project, ...prev.projects],
      activities: [activity, ...prev.activities],
    }));
    return project;
  }, []);

  const updateProject = useCallback((id: string, input: ProjectInput) => {
    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((project) =>
        project.id === id
          ? {
              ...project,
              name: input.name,
              description: input.description,
              status: input.status,
              technologies: input.technologies,
              githubFullName: input.githubFullName,
              updatedAt: new Date().toISOString(),
            }
          : project,
      ),
    }));
  }, []);

  const deleteProject = useCallback((id: string) => {
    setState((prev) => ({
      projects: prev.projects.filter((p) => p.id !== id),
      features: prev.features.filter((f) => f.projectId !== id),
      notes: prev.notes.filter((n) => n.projectId !== id),
      tasks: prev.tasks.filter((t) => t.projectId !== id),
      activities: prev.activities.filter((a) => a.projectId !== id),
    }));
  }, []);

  const createFeature = useCallback(
    (projectId: string, input: FeatureInput): ProjectFeature => {
      const timestamp = now();
      const feature: ProjectFeature = {
        id: createId(),
        projectId,
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        acceptanceCriteria: input.acceptanceCriteria,
        githubIssueNumber: null,
        githubIssueUrl: null,
        targetDate: input.targetDate,
        completedAt: input.status === "completed" ? timestamp : null,
        position: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      setState((prev) => ({
        ...prev,
        features: [
          ...prev.features,
          { ...feature, position: prev.features.filter((f) => f.projectId === projectId).length },
        ],
      }));
      logActivity(projectId, "feature_created", `"${input.title}" özelliği eklendi`);
      return feature;
    },
    [logActivity],
  );

  const updateFeature = useCallback((id: string, input: FeatureInput) => {
    setState((prev) => ({
      ...prev,
      features: prev.features.map((feature) =>
        feature.id === id
          ? {
              ...feature,
              title: input.title,
              description: input.description,
              status: input.status,
              priority: input.priority,
              acceptanceCriteria: input.acceptanceCriteria,
              targetDate: input.targetDate,
              completedAt:
                input.status === "completed"
                  ? (feature.completedAt ?? new Date().toISOString())
                  : null,
              updatedAt: new Date().toISOString(),
            }
          : feature,
      ),
    }));
  }, []);

  const patchFeature = useCallback((id: string, patch: Partial<ProjectFeature>) => {
    setState((prev) => ({
      ...prev,
      features: prev.features.map((feature) =>
        feature.id === id
          ? { ...feature, ...patch, id: feature.id, updatedAt: new Date().toISOString() }
          : feature,
      ),
    }));
  }, []);

  const deleteFeature = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      features: prev.features.filter((f) => f.id !== id),
      notes: prev.notes.map((n) =>
        n.relatedFeatureId === id ? { ...n, relatedFeatureId: null } : n,
      ),
      tasks: prev.tasks.map((t) =>
        t.relatedFeatureId === id ? { ...t, relatedFeatureId: null } : t,
      ),
    }));
  }, []);

  const createNote = useCallback(
    (projectId: string, input: NoteInput): ProjectNote => {
      const timestamp = now();
      const note: ProjectNote = {
        id: createId(),
        projectId,
        title: input.title,
        content: input.content,
        relatedFeatureId: input.relatedFeatureId,
        tags: input.tags,
        pinned: input.pinned,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      setState((prev) => ({ ...prev, notes: [note, ...prev.notes] }));
      logActivity(projectId, "note_created", `"${input.title}" notu oluşturuldu`);
      return note;
    },
    [logActivity],
  );

  const updateNote = useCallback((id: string, input: NoteInput) => {
    setState((prev) => ({
      ...prev,
      notes: prev.notes.map((note) =>
        note.id === id
          ? { ...note, ...input, updatedAt: new Date().toISOString() }
          : note,
      ),
    }));
  }, []);

  const patchNote = useCallback((id: string, patch: Partial<ProjectNote>) => {
    setState((prev) => ({
      ...prev,
      notes: prev.notes.map((note) =>
        note.id === id
          ? { ...note, ...patch, id: note.id, updatedAt: new Date().toISOString() }
          : note,
      ),
    }));
  }, []);

  const deleteNote = useCallback((id: string) => {
    setState((prev) => ({ ...prev, notes: prev.notes.filter((n) => n.id !== id) }));
  }, []);

  const createTask = useCallback(
    (projectId: string, input: TaskInput): ProjectTask => {
      const timestamp = now();
      const task: ProjectTask = {
        id: createId(),
        projectId,
        title: input.title,
        description: input.description,
        completed: input.completed,
        priority: input.priority,
        relatedFeatureId: input.relatedFeatureId,
        githubIssueNumber: null,
        dueDate: input.dueDate,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      setState((prev) => ({ ...prev, tasks: [task, ...prev.tasks] }));
      return task;
    },
    [],
  );

  const patchTask = useCallback((id: string, patch: Partial<ProjectTask>) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) =>
        task.id === id
          ? { ...task, ...patch, id: task.id, updatedAt: new Date().toISOString() }
          : task,
      ),
    }));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setState((prev) => ({ ...prev, tasks: prev.tasks.filter((t) => t.id !== id) }));
  }, []);

  const addActivity = useCallback((activity: Omit<ProjectActivity, "id">) => {
    setState((prev) => ({
      ...prev,
      activities: [{ ...activity, id: createId() }, ...prev.activities].slice(0, 300),
    }));
  }, []);

  return {
    ...state,
    hydrated,
    localMode,
    createProject,
    updateProject,
    deleteProject,
    createFeature,
    updateFeature,
    patchFeature,
    deleteFeature,
    createNote,
    updateNote,
    patchNote,
    deleteNote,
    createTask,
    patchTask,
    deleteTask,
    addActivity,
  };
}
