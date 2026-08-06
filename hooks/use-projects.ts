"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { useAuth } from "@/components/auth/auth-provider";
import {
  EMPTY_STATE,
  createId,

  type ProjectsState,
} from "@/lib/projects/store";
import { fetchProjectsBundle } from "@/lib/projects/queries";
import * as db from "@/lib/projects/mutations";
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

/**
 * Depolama modu:
 *  local      — Supabase yapılandırılmamış, veriler yalnızca bu tarayıcıda
 *  needs_auth — Supabase var ama oturum yok; kullanıcı giriş yapmalı
 *  cloud      — Supabase + oturum: veriler bulutta, RLS ile korunuyor
 */
export type StorageMode = "loading" | "local" | "needs_auth" | "cloud";

export type ProjectsApi = ProjectsState & {
  hydrated: boolean;
  mode: StorageMode;
  userEmail: string | null;
  /** API uçlarına Authorization başlığı için — sunucu tarafında doğrulanır. */
  accessToken: string | null;
  error: string | null;

  signOut: () => Promise<void>;

  createProject: (input: ProjectInput) => Promise<Project | null>;
  updateProject: (id: string, input: ProjectInput) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  createFeature: (projectId: string, input: FeatureInput) => Promise<void>;
  updateFeature: (id: string, input: FeatureInput) => Promise<void>;
  patchFeature: (id: string, patch: Partial<ProjectFeature>) => Promise<void>;
  deleteFeature: (id: string) => Promise<void>;

  createNote: (projectId: string, input: NoteInput) => Promise<void>;
  updateNote: (id: string, input: NoteInput) => Promise<void>;
  patchNote: (id: string, patch: Partial<ProjectNote>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;

  createTask: (projectId: string, input: TaskInput) => Promise<void>;
  patchTask: (id: string, patch: Partial<ProjectTask>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;

  addActivity: (activity: Omit<ProjectActivity, "id">) => Promise<void>;
};

const now = () => new Date().toISOString();

export function useProjects(): ProjectsApi {
  const auth = useAuth();
  const [state, setState] = useState<ProjectsState>(EMPTY_STATE);
  const [mode, setMode] = useState<StorageMode>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<SupabaseClient | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Oturum artık AuthProvider'da tek yerden yönetiliyor; bu hook onu tüketir.
  // Giriş duvarı sayesinde buraya yalnızca oturum açıkken gelinir, bu yüzden
  // "yerel mod" ve "giriş gerekli" durumları burada ele alınmaz.
  useEffect(() => {
    clientRef.current = auth.client;

    if (auth.status === "loading") {
      setMode("loading");
      return;
    }

    if (auth.status !== "signed_in") {
      setMode("needs_auth");
      setHydrated(true);
      return;
    }

    setSession(auth.session);
    setMode("cloud");
    setHydrated(true);
  }, [auth.client, auth.status, auth.session]);

  const reload = useCallback(async () => {
    const client = clientRef.current;
    if (!client || !session?.user) return;
    try {
      const bundle = await fetchProjectsBundle(client, session.user.id);
      if (mountedRef.current) {
        setState(bundle);
        setError(null);
      }
    } catch (caught) {
      // Supabase'in kendi mesajı korunur. "Tablo yok", "izin yok" ve "ağ
      // hatası" bambaşka sorunlar; üçünü tek cümleye indirmek nedeni
      // kullanıcıdan da geliştiriciden de gizliyor.
      if (mountedRef.current) {
        const detail = caught instanceof Error ? caught.message.trim() : "";
        setError(
          detail
            ? `Proje verileri yüklenemedi: ${detail}`
            : "Proje verileri yüklenemedi.",
        );
      }
    }
  }, [session]);

  // Bulut modunda veriyi çek + Realtime'a abone ol
  useEffect(() => {
    const client = clientRef.current;
    if (mode !== "cloud" || !client || !session?.user) return;

    void reload();

    const channel = client
      .channel("bitig-projects")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_activities" },
        () => void reload(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        () => void reload(),
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [mode, session, reload]);

  // Yerel mod kaldırıldı (giriş zorunlu). writeProjectsState yalnızca içe
  // aktarma akışının eski kaydı temizlemesi için duruyor.

  const isCloud = mode === "cloud";
  const client = clientRef.current;
  const userId = session?.user?.id ?? null;

  /** Bulutta işlemi yapar, sonra durumu tazeler; yerelde doğrudan state'i günceller. */
  const run = useCallback(
    async (cloud: () => Promise<void>, local: () => void) => {
      if (isCloud && client && userId) {
        try {
          await cloud();
          await reload();
          setError(null);
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "İşlem kaydedilemedi.");
        }
      } else {
        local();
      }
    },
    [isCloud, client, userId, reload],
  );

  // Kimlik doğrulama AuthProvider'a taşındı; buradaki signIn/signUp kopyaları
  // kaldırıldı. signOut sarmalayıcı kalıyor: çıkarken ekrandaki veri de silinsin.
  const signOut = useCallback(async () => {
    await auth.signOut();
    setState(EMPTY_STATE);
  }, [auth]);

  // --- Projeler ---

  const createProject = useCallback(
    async (input: ProjectInput): Promise<Project | null> => {
      if (isCloud && client && userId) {
        try {
          const project = await db.insertProject(client, userId, input);
          await db.insertActivity(client, {
            projectId: project.id,
            source: "bitig",
            type: "project_created",
            title: "Proje oluşturuldu",
            description: project.name,
            externalUrl: null,
            occurredAt: now(),
          });
          await reload();
          return project;
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Proje oluşturulamadı.");
          return null;
        }
      }

      const timestamp = now();
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
    },
    [isCloud, client, userId, reload],
  );

  const updateProject = useCallback(
    (id: string, input: ProjectInput) =>
      run(
        () => db.updateProjectRow(client!, id, input),
        () =>
          setState((prev) => ({
            ...prev,
            projects: prev.projects.map((project) =>
              project.id === id
                ? { ...project, ...input, updatedAt: now() }
                : project,
            ),
          })),
      ),
    [run, client],
  );

  const deleteProject = useCallback(
    (id: string) =>
      run(
        () => db.deleteProjectRow(client!, id),
        () =>
          setState((prev) => ({
            projects: prev.projects.filter((p) => p.id !== id),
            features: prev.features.filter((f) => f.projectId !== id),
            notes: prev.notes.filter((n) => n.projectId !== id),
            tasks: prev.tasks.filter((t) => t.projectId !== id),
            activities: prev.activities.filter((a) => a.projectId !== id),
          })),
      ),
    [run, client],
  );

  // --- Özellikler ---

  const createFeature = useCallback(
    (projectId: string, input: FeatureInput) =>
      run(
        async () => {
          const position = state.features.filter((f) => f.projectId === projectId).length;
          await db.insertFeature(client!, projectId, input, position);
          await db.insertActivity(client!, {
            projectId,
            source: "bitig",
            type: "feature_created",
            title: `"${input.title}" özelliği eklendi`,
            description: null,
            externalUrl: null,
            occurredAt: now(),
          });
        },
        () => {
          const timestamp = now();
          setState((prev) => ({
            ...prev,
            features: [
              ...prev.features,
              {
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
                position: prev.features.filter((f) => f.projectId === projectId).length,
                createdAt: timestamp,
                updatedAt: timestamp,
              },
            ],
            activities: [
              {
                id: createId(),
                projectId,
                source: "bitig",
                type: "feature_created",
                title: `"${input.title}" özelliği eklendi`,
                description: null,
                externalUrl: null,
                occurredAt: timestamp,
              },
              ...prev.activities,
            ],
          }));
        },
      ),
    [run, client, state.features],
  );

  const updateFeature = useCallback(
    (id: string, input: FeatureInput) =>
      run(
        () => db.updateFeatureRow(client!, id, input),
        () =>
          setState((prev) => ({
            ...prev,
            features: prev.features.map((feature) =>
              feature.id === id
                ? {
                    ...feature,
                    ...input,
                    completedAt:
                      input.status === "completed"
                        ? (feature.completedAt ?? now())
                        : null,
                    updatedAt: now(),
                  }
                : feature,
            ),
          })),
      ),
    [run, client],
  );

  const patchFeature = useCallback(
    (id: string, patch: Partial<ProjectFeature>) =>
      run(
        () => db.patchFeatureRow(client!, id, patch),
        () =>
          setState((prev) => ({
            ...prev,
            features: prev.features.map((feature) =>
              feature.id === id
                ? { ...feature, ...patch, id: feature.id, updatedAt: now() }
                : feature,
            ),
          })),
      ),
    [run, client],
  );

  const deleteFeature = useCallback(
    (id: string) =>
      run(
        () => db.deleteFeatureRow(client!, id),
        () =>
          setState((prev) => ({
            ...prev,
            features: prev.features.filter((f) => f.id !== id),
            notes: prev.notes.map((n) =>
              n.relatedFeatureId === id ? { ...n, relatedFeatureId: null } : n,
            ),
            tasks: prev.tasks.map((t) =>
              t.relatedFeatureId === id ? { ...t, relatedFeatureId: null } : t,
            ),
          })),
      ),
    [run, client],
  );

  // --- Notlar ---

  const createNote = useCallback(
    (projectId: string, input: NoteInput) =>
      run(
        async () => {
          await db.insertNote(client!, projectId, input);
          await db.insertActivity(client!, {
            projectId,
            source: "bitig",
            type: "note_created",
            title: `"${input.title}" notu oluşturuldu`,
            description: null,
            externalUrl: null,
            occurredAt: now(),
          });
        },
        () => {
          const timestamp = now();
          setState((prev) => ({
            ...prev,
            notes: [
              {
                id: createId(),
                projectId,
                title: input.title,
                content: input.content,
                relatedFeatureId: input.relatedFeatureId,
                tags: input.tags,
                pinned: input.pinned,
                createdAt: timestamp,
                updatedAt: timestamp,
              },
              ...prev.notes,
            ],
          }));
        },
      ),
    [run, client],
  );

  const updateNote = useCallback(
    (id: string, input: NoteInput) =>
      run(
        () => db.updateNoteRow(client!, id, input),
        () =>
          setState((prev) => ({
            ...prev,
            notes: prev.notes.map((note) =>
              note.id === id ? { ...note, ...input, updatedAt: now() } : note,
            ),
          })),
      ),
    [run, client],
  );

  const patchNote = useCallback(
    (id: string, patch: Partial<ProjectNote>) =>
      run(
        () => db.patchNoteRow(client!, id, patch),
        () =>
          setState((prev) => ({
            ...prev,
            notes: prev.notes.map((note) =>
              note.id === id ? { ...note, ...patch, id: note.id, updatedAt: now() } : note,
            ),
          })),
      ),
    [run, client],
  );

  const deleteNote = useCallback(
    (id: string) =>
      run(
        () => db.deleteNoteRow(client!, id),
        () => setState((prev) => ({ ...prev, notes: prev.notes.filter((n) => n.id !== id) })),
      ),
    [run, client],
  );

  // --- Görevler ---

  const createTask = useCallback(
    (projectId: string, input: TaskInput) =>
      run(
        async () => {
          await db.insertTask(client!, projectId, input);
        },
        () => {
          const timestamp = now();
          setState((prev) => ({
            ...prev,
            tasks: [
              {
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
              },
              ...prev.tasks,
            ],
          }));
        },
      ),
    [run, client],
  );

  const patchTask = useCallback(
    (id: string, patch: Partial<ProjectTask>) =>
      run(
        () => db.patchTaskRow(client!, id, patch),
        () =>
          setState((prev) => ({
            ...prev,
            tasks: prev.tasks.map((task) =>
              task.id === id ? { ...task, ...patch, id: task.id, updatedAt: now() } : task,
            ),
          })),
      ),
    [run, client],
  );

  const deleteTask = useCallback(
    (id: string) =>
      run(
        () => db.deleteTaskRow(client!, id),
        () => setState((prev) => ({ ...prev, tasks: prev.tasks.filter((t) => t.id !== id) })),
      ),
    [run, client],
  );

  const addActivity = useCallback(
    (activity: Omit<ProjectActivity, "id">) =>
      run(
        async () => {
          await db.insertActivity(client!, activity);
        },
        () =>
          setState((prev) => ({
            ...prev,
            activities: [{ ...activity, id: createId() }, ...prev.activities].slice(0, 300),
          })),
      ),
    [run, client],
  );

  return {
    ...state,
    hydrated,
    mode,
    userEmail: session?.user?.email ?? null,
    accessToken: session?.access_token ?? null,
    error,
    signOut,
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
