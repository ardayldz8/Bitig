"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Github } from "lucide-react";
import Modal from "@/components/ui/modal";
import AiDraftPreview, { type DraftPreview } from "@/components/projects/ai-draft-preview";
import FeatureFormModal from "@/components/projects/feature-form-modal";
import GithubConnectModal from "@/components/projects/github-connect-modal";
import NoteFormModal from "@/components/projects/note-form-modal";
import ProjectActivityFeed from "@/components/projects/project-activity";
import ProjectAiAssistant, { type AiStage } from "@/components/projects/project-ai-assistant";
import ProjectDetail from "@/components/projects/project-detail";
import ProjectFeatures from "@/components/projects/project-features";
import ProjectFiles from "@/components/projects/project-files";
import ProjectFormModal from "@/components/projects/project-form-modal";
import ProjectGithub from "@/components/projects/project-github";
import ProjectNotes from "@/components/projects/project-notes";
import ProjectOverview from "@/components/projects/project-overview";
import ProjectSidebar, { type ProjectFilter } from "@/components/projects/project-sidebar";
import ProjectStats, { type StatsData } from "@/components/projects/project-stats";
import ProjectTasks from "@/components/projects/project-tasks";
import ProjectsHeader from "@/components/projects/projects-header";
import RepositoryPicker from "@/components/projects/repository-picker";
import { useAuth } from "@/components/auth/auth-provider";
import { useProjects } from "@/hooks/use-projects";
import { useActionParam } from "@/hooks/use-action-param";
import { useGithubInstallation } from "@/hooks/use-github-installation";
import { loadSnapshots, saveSnapshot } from "@/lib/projects/github-snapshot";
import { computeHealth } from "@/lib/projects/health";
import { computeMetrics } from "@/lib/projects/metrics";
import type { FeatureInput, NoteInput, ProjectInput } from "@/lib/projects/validation";
import type {
  FeatureDraft,
  GitHubIssueDraft,
  ProjectSummary,
  ReleaseNotesDraft,
  RoadmapDraft,
} from "@/lib/ai/schemas";
import type { IntegrationsSnapshot } from "@/lib/env";
import type { RepositorySnapshot } from "@/types/github";
import {
  isProjectTab,
  type FeaturePriority,
  type Project,
  type ProjectFeature,
  type ProjectNote,
  type ProjectTab,
} from "@/types/project";

type Dialog =
  | { type: "none" }
  | { type: "project"; project: Project | null }
  | { type: "feature"; feature: ProjectFeature | null; initial?: Partial<FeatureInput> }
  | { type: "note"; note: ProjectNote | null }
  | { type: "github" }
  | { type: "repos"; installationId: number }
  | { type: "confirm"; title: string; message: string; onConfirm: () => void };

export default function ProjectsPage({
  integrations,
}: {
  integrations: IntegrationsSnapshot;
}) {
  const library = useProjects();
  const { client: supabase } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const confirmId = useId();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ProjectFilter>("all");
  const [dialog, setDialog] = useState<Dialog>({ type: "none" });

  // Ana sayfadaki "Proje ekle" hızlı işlemi.
  // Oturum bekleniyorsa form AÇILMAZ — önce giriş yapılmalı, aksi hâlde
  // kayıt sessizce yerele yazılırdı.
  const addAction = useActionParam("add");
  useEffect(() => {
    if (addAction.triggered && library.mode !== "needs_auth" && library.mode !== "loading") {
      setDialog({ type: "project", project: null });
    }
  }, [addAction.triggered, library.mode]);
  const [draft, setDraft] = useState<DraftPreview | null>(null);
  const [creatingIssue, setCreatingIssue] = useState(false);

  const [snapshots, setSnapshots] = useState<Record<string, RepositorySnapshot>>({});
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [aiBusy, setAiBusy] = useState<AiStage>("idle");
  const [aiError, setAiError] = useState<string | null>(null);
  const [busyNoteId, setBusyNoteId] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, ProjectSummary>>({});
  const [roadmap, setRoadmap] = useState<RoadmapDraft | null>(null);
  const [releaseNotes, setReleaseNotes] = useState<ReleaseNotesDraft | null>(null);

  const selectedId = params.get("project");
  const tabParam = params.get("tab") ?? "overview";
  const tab: ProjectTab = isProjectTab(tabParam) ? tabParam : "overview";

  const selected = useMemo(
    () => library.projects.find((project) => project.id === selectedId) ?? null,
    [library.projects, selectedId],
  );

  /** Seçili proje ve sekme URL'de tutulur → yenilemede kaybolmaz. */
  const setParam = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      router.replace(`/projeler?${next.toString()}`, { scroll: false });
    },
    [params, router],
  );

  /**
   * Açılışta ilk projeyi seç — YALNIZCA BİR KEZ.
   *
   * Ref olmadan "Projelere dön" çalışmıyordu: düğme seçimi temizliyor,
   * selectedId null oluyor ve bu effect aynı anda ilk projeyi geri seçiyordu.
   * Kullanıcı açısından düğme hiç tepki vermemiş gibi görünüyordu.
   *
   * Karar hydrate olur olmaz veriliyor (proje listesi boş olsa bile): aksi
   * hâlde ilk proje oluşturulduğunda bayrak hâlâ kapalı kalıyor ve aynı hata
   * o anda geri geliyordu.
   */
  const ilkSecimYapildi = useRef(false);
  useEffect(() => {
    if (ilkSecimYapildi.current || !library.hydrated) return;
    ilkSecimYapildi.current = true;

    // Derin bağlantıyla gelinmişse ya da hiç proje yoksa dokunma
    if (selectedId || library.projects.length === 0) return;
    setParam({ project: library.projects[0].id });
  }, [library.hydrated, library.projects, selectedId, setParam]);

  /**
   * Kaydedilmiş GitHub anlık görüntülerini yükle.
   *
   * Senkronizasyon sonucu artık veritabanında; açılışta okunmazsa PR sayısı ve
   * son commit her yenilemede sıfırlanmış görünür.
   */
  const projectIdsKey = library.projects.map((project) => project.id).join(",");
  useEffect(() => {
    if (!supabase || projectIdsKey === "") return;

    let cancelled = false;
    void loadSnapshots(supabase, projectIdsKey.split(","))
      .then((stored) => {
        if (cancelled) return;
        // Bu oturumda senkronize edilenler korunur: taze veri, kayıtlı
        // görüntüden daha günceldir (dosya ağacı ve branch'ler de dolu).
        setSnapshots((prev) => ({ ...stored, ...prev }));
      })
      .catch(() => {
        // Okunamazsa sayfa çalışmaya devam eder; "Senkronize et" hâlâ mümkün
      });

    return () => {
      cancelled = true;
    };
  }, [supabase, projectIdsKey]);

  /**
   * GitHub bağlantısı. URL'deki installation_id kurulumdan dönüşte bir kez
   * gelir; kaydedildikten sonra adresten temizlenir, kalıcı kaynak sunucudur.
   */
  const pendingInstallationId = Number(params.get("installation_id")) || null;
  const consumeInstallationParam = useCallback(() => {
    setParam({ installation_id: null, github: null, account: null });
  }, [setParam]);

  const github = useGithubInstallation({
    enabled: integrations.github,
    mode: library.mode,
    accessToken: library.accessToken,
    pendingInstallationId,
    onConsumed: consumeInstallationParam,
  });

  const installationId = github.installation?.installationId ?? null;
  const githubAccount = github.installation?.accountLogin ?? null;
  const githubConnected = integrations.github && installationId !== null;

  /** GitHub uçları kurulumun sahibini token'dan doğruluyor. */
  const githubHeaders = useMemo<Record<string, string>>(
    () => ({
      "Content-Type": "application/json",
      ...(library.accessToken ? { Authorization: `Bearer ${library.accessToken}` } : {}),
    }),
    [library.accessToken],
  );

  const projectFeatures = useMemo(
    () => library.features.filter((f) => f.projectId === selected?.id),
    [library.features, selected?.id],
  );
  const projectNotes = useMemo(
    () => library.notes.filter((n) => n.projectId === selected?.id),
    [library.notes, selected?.id],
  );
  const projectTasks = useMemo(
    () => library.tasks.filter((t) => t.projectId === selected?.id),
    [library.tasks, selected?.id],
  );
  const projectActivities = useMemo(
    () => library.activities.filter((a) => a.projectId === selected?.id),
    [library.activities, selected?.id],
  );

  const snapshot = selected ? (snapshots[selected.id] ?? null) : null;

  const metrics = useMemo(
    () => computeMetrics({ snapshot, features: projectFeatures, tasks: projectTasks }),
    [snapshot, projectFeatures, projectTasks],
  );
  const health = useMemo(() => computeHealth(metrics), [metrics]);

  const stats: StatsData = useMemo(() => {
    let openPullRequests = 0;
    let openIssues = 0;
    let failingCi = 0;
    for (const project of library.projects) {
      const snap = snapshots[project.id];
      if (!snap) continue;
      openPullRequests += snap.pullRequests.filter((pr) => pr.state === "open").length;
      openIssues += snap.issues.filter((issue) => issue.state === "open").length;
      if (snap.workflowRuns.some((run) => run.conclusion === "failure")) failingCi += 1;
    }
    return {
      totalProjects: library.projects.length,
      activeProjects: library.projects.filter((p) => p.status === "active").length,
      completedProjects: library.projects.filter((p) => p.status === "completed").length,
      totalFeatures: library.features.length,
      openPullRequests,
      openIssues,
      failingCi,
    };
  }, [library.projects, library.features, snapshots]);

  const visibleProjects = useMemo(() => {
    const term = query.trim().toLowerCase();
    return library.projects.filter((project) => {
      if (term && !project.name.toLowerCase().includes(term)) return false;
      if (filter === "all") return true;
      if (filter === "github") return project.githubFullName !== null;
      return project.status === filter;
    });
  }, [library.projects, query, filter]);

  const featureCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const feature of library.features) {
      counts[feature.projectId] = (counts[feature.projectId] ?? 0) + 1;
    }
    return counts;
  }, [library.features]);

  /** AI uçlarına gönderilecek bağlam — backend ne göndereceğimizi doğrular. */
  const buildContext = useCallback(() => {
    if (!selected) return null;
    return {
      project: {
        name: selected.name,
        description: selected.description,
        status: selected.status,
        technologies: selected.technologies,
        githubFullName: selected.githubFullName,
      },
      repository: snapshot
        ? {
            readme: snapshot.repository.readme,
            languages: snapshot.repository.languages,
            defaultBranch: snapshot.repository.defaultBranch,
            files: snapshot.files.map((file) => ({
              path: file.path,
              important: file.important,
            })),
          }
        : null,
      commits: snapshot?.commits.slice(0, 30) ?? [],
      pullRequests: snapshot?.pullRequests.slice(0, 30) ?? [],
      issues: snapshot?.issues.slice(0, 30) ?? [],
      workflowRuns: snapshot?.workflowRuns.slice(0, 15) ?? [],
      features: projectFeatures.map((f) => ({
        title: f.title,
        description: f.description,
        status: f.status,
        priority: f.priority,
      })),
      notes: projectNotes.map((n) => ({ title: n.title, content: n.content })),
      tasks: projectTasks.map((t) => ({
        title: t.title,
        completed: t.completed,
        priority: t.priority,
      })),
    };
  }, [selected, snapshot, projectFeatures, projectNotes, projectTasks]);

  async function callAi<T>(url: string, body: unknown, pick: (data: unknown) => T | null) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        typeof payload === "object" && payload !== null
          ? (payload as { error?: unknown }).error
          : null;
      throw new Error(typeof message === "string" ? message : "AI isteği başarısız.");
    }
    const value = pick(payload);
    if (value === null) throw new Error("AI yanıtı okunamadı.");
    return value;
  }

  const handleSummary = useCallback(async () => {
    const context = buildContext();
    if (!context || !selected) return;
    setAiBusy("summary");
    setAiError(null);
    try {
      const summary = await callAi("/api/projects/ai/summary", context, (data) =>
        typeof data === "object" && data !== null
          ? ((data as { summary?: ProjectSummary }).summary ?? null)
          : null,
      );
      setSummaries((prev) => ({ ...prev, [selected.id]: summary }));
      void library.addActivity({
        projectId: selected.id,
        source: "ai",
        type: "ai_summary",
        title: "AI proje özeti oluşturuldu",
        description: null,
        externalUrl: null,
        occurredAt: new Date().toISOString(),
      });
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "AI özeti oluşturulamadı.");
    } finally {
      setAiBusy("idle");
    }
  }, [buildContext, library, selected]);

  const handleRoadmap = useCallback(async () => {
    const context = buildContext();
    if (!context) return;
    setAiBusy("roadmap");
    setAiError(null);
    try {
      setRoadmap(
        await callAi("/api/projects/ai/roadmap", context, (data) =>
          typeof data === "object" && data !== null
            ? ((data as { roadmap?: RoadmapDraft }).roadmap ?? null)
            : null,
        ),
      );
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Roadmap oluşturulamadı.");
    } finally {
      setAiBusy("idle");
    }
  }, [buildContext]);

  const handleReleaseNotes = useCallback(async () => {
    const context = buildContext();
    if (!context) return;
    setAiBusy("release");
    setAiError(null);
    try {
      setReleaseNotes(
        await callAi("/api/projects/ai/release-notes", context, (data) =>
          typeof data === "object" && data !== null
            ? ((data as { notes?: ReleaseNotesDraft }).notes ?? null)
            : null,
        ),
      );
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Release note oluşturulamadı.");
    } finally {
      setAiBusy("idle");
    }
  }, [buildContext]);

  const handleNoteToFeature = useCallback(
    async (note: ProjectNote) => {
      const context = buildContext();
      if (!context) return;
      setBusyNoteId(note.id);
      setAiError(null);
      try {
        const featureDraft = await callAi(
          "/api/projects/ai/feature-draft",
          { context, noteContent: note.content, noteTitle: note.title },
          (data) =>
            typeof data === "object" && data !== null
              ? ((data as { draft?: FeatureDraft }).draft ?? null)
              : null,
        );
        setDraft({ kind: "feature", draft: featureDraft });
      } catch (error) {
        setAiError(error instanceof Error ? error.message : "Taslak oluşturulamadı.");
      } finally {
        setBusyNoteId(null);
      }
    },
    [buildContext],
  );

  const handleIssueDraft = useCallback(
    async (title: string, content: string, acceptanceCriteria: string[]) => {
      const context = buildContext();
      if (!context) return;
      setAiError(null);
      try {
        const issueDraft = await callAi(
          "/api/projects/ai/issue-draft",
          { context, sourceTitle: title, sourceContent: content, acceptanceCriteria },
          (data) =>
            typeof data === "object" && data !== null
              ? ((data as { draft?: GitHubIssueDraft }).draft ?? null)
              : null,
        );
        setDraft({
          kind: "issue",
          draft: issueDraft,
          canCreate: githubConnected && selected?.githubFullName !== null,
        });
      } catch (error) {
        setAiError(error instanceof Error ? error.message : "Issue taslağı oluşturulamadı.");
      }
    },
    [buildContext, githubConnected, selected],
  );

  /** GitHub'a TEK yazma işlemi — yalnızca kullanıcı onayıyla. */
  const handleConfirmIssue = useCallback(
    async (issueDraft: GitHubIssueDraft) => {
      if (!selected?.githubFullName || installationId === null) return;
      setCreatingIssue(true);
      try {
        const response = await fetch("/api/github/issues", {
          method: "POST",
          headers: githubHeaders,
          body: JSON.stringify({
            installationId,
            fullName: selected.githubFullName,
            title: issueDraft.title,
            body: issueDraft.body,
            labels: issueDraft.labels,
            confirmed: true,
          }),
        });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const message =
            typeof payload === "object" && payload !== null
              ? (payload as { error?: unknown }).error
              : null;
          throw new Error(typeof message === "string" ? message : "Issue oluşturulamadı.");
        }
        void library.addActivity({
          projectId: selected.id,
          source: "github",
          type: "issue",
          title: `Issue oluşturuldu: ${issueDraft.title}`,
          description: null,
          externalUrl: null,
          occurredAt: new Date().toISOString(),
        });
        setDraft(null);
      } catch (error) {
        setAiError(error instanceof Error ? error.message : "Issue oluşturulamadı.");
      } finally {
        setCreatingIssue(false);
      }
    },
    [githubHeaders, installationId, library, selected],
  );

  const handleSync = useCallback(async () => {
    if (!selected?.githubFullName || installationId === null) return;
    setSyncing(true);
    setSyncError(null);
    try {
      const response = await fetch("/api/github/sync", {
        method: "POST",
        headers: githubHeaders,
        body: JSON.stringify({ installationId, fullName: selected.githubFullName }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          typeof payload === "object" && payload !== null
            ? (payload as { error?: unknown }).error
            : null;
        throw new Error(
          typeof message === "string" ? message : "Repository senkronize edilemedi.",
        );
      }
      const snap =
        typeof payload === "object" && payload !== null
          ? ((payload as { snapshot?: RepositorySnapshot }).snapshot ?? null)
          : null;
      if (snap) {
        setSnapshots((prev) => ({ ...prev, [selected.id]: snap }));

        // Veritabanına da yaz: yalnızca state'te kalsaydı sayfa yenilenince
        // PR sayısı, son commit ve CI durumu kaybolurdu.
        if (supabase) {
          await saveSnapshot(supabase, selected.id, snap);
          await library.reload();
        }
      }
    } catch (error) {
      setSyncError(
        error instanceof Error ? error.message : "Repository senkronize edilemedi.",
      );
    } finally {
      setSyncing(false);
    }
  }, [githubHeaders, installationId, selected, supabase, library]);

  const closeDialog = () => {
    setDialog({ type: "none" });
    addAction.clear();
  };

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[1400px] px-4 pt-8 pb-16 sm:px-6 sm:pt-10">
      <ProjectsHeader
        githubConnected={githubConnected}
        githubAccount={githubAccount}
        githubLoading={github.loading}
        mode={library.mode}
        userEmail={library.userEmail}
        onNewProject={() => setDialog({ type: "project", project: null })}
        onConnectGithub={() => setDialog({ type: "github" })}
        onDisconnectGithub={() =>
          setDialog({
            type: "confirm",
            title: "GitHub bağlantısını kaldır",
            message:
              "Uygulamadaki bağlantı kaydı silinecek. GitHub App hesabında kurulu kalır; tamamen kaldırmak için GitHub ayarlarından da silmen gerekir.",
            onConfirm: () => void github.disconnect(),
          })
        }
        onSignOut={() => void library.signOut()}
      />

      {library.error && (
        <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
          {library.error}
        </p>
      )}

      {/* Kurulum kaydı oluşturulamazsa sessiz kalmasın — bağlantı kurulmuş görünüp
          çalışmaması, hata göstermekten daha kötü. */}
      {github.error && (
        <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
          GitHub: {github.error}
        </p>
      )}

      <div className="mt-6">
        <ProjectStats stats={stats} />
      </div>

      {!library.hydrated ? (
        <div aria-busy="true" className="mt-6 h-96 rounded-card border border-line bg-surface" />
      ) : library.projects.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-line-strong bg-surface p-10 text-center">
          <p className="font-medium text-ink">Henüz proje yok</p>
          <p className="mt-1.5 text-sm text-ink-soft">
            {githubConnected
              ? "Boş bir proje oluştur ya da GitHub repository'lerinden birini seç."
              : "İlk projeni oluştur. GitHub'ı bağlarsan repository'lerinden de başlayabilirsin."}
          </p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setDialog({ type: "project", project: null })}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 font-medium text-white transition-colors hover:bg-brand-strong"
            >
              Boş proje oluştur
            </button>

            {/* Bağlantı yoksa gösterilmez: tıklanınca hiçbir şey yapmayan bir
                düğme, olmayan düğmeden daha kötü. */}
            {githubConnected && installationId !== null && (
              <button
                type="button"
                onClick={() => setDialog({ type: "repos", installationId })}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line px-4 font-medium text-ink transition-colors hover:border-brand hover:text-brand"
              >
                <Github size={16} aria-hidden="true" />
                Repository&apos;den oluştur
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-6 grid min-w-0 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          {/*
            `min-w-0`: grid track'i varsayılan olarak `auto`, yani içeriğin
            min-content genişliğinin altına inemiyor. Uzun commit mesajları ve
            sekme şeridi track'i 638px'e şişirip tüm sayfayı yatay
            kaydırılabilir yapıyordu (375px ekranda belge 654px oluyordu).

            Mobilde: proje seçiliyken liste gizlenir.
          */}
          <div className={`min-w-0 ${selected ? "hidden lg:block" : "block"}`}>
            <ProjectSidebar
              projects={visibleProjects}
              selectedId={selected?.id ?? null}
              query={query}
              filter={filter}
              featureCounts={featureCounts}
              onQueryChange={setQuery}
              onFilterChange={setFilter}
              onSelect={(id) => setParam({ project: id, tab: "overview" })}
            />
          </div>

          <div className={`min-w-0 ${selected ? "block" : "hidden lg:block"}`}>
            {selected ? (
              <ProjectDetail
                project={selected}
                snapshot={snapshot}
                tab={tab}
                syncing={syncing}
                syncError={syncError}
                canSync={githubConnected && selected.githubFullName !== null}
                onTabChange={(next) => setParam({ tab: next })}
                onEdit={() => setDialog({ type: "project", project: selected })}
                onDelete={() =>
                  setDialog({
                    type: "confirm",
                    title: "Projeyi sil",
                    message: `"${selected.name}" projesi ve tüm özellik, not ve görevleri silinecek. Bu işlem geri alınamaz.`,
                    onConfirm: () => {
                      void library.deleteProject(selected.id);
                      setParam({ project: null });
                      closeDialog();
                    },
                  })
                }
                onSync={handleSync}
                onLinkRepository={() =>
                  installationId === null
                    ? setDialog({ type: "github" })
                    : setDialog({ type: "repos", installationId })
                }
                onBack={() => setParam({ project: null })}
              >
                {tab === "overview" && (
                  <ProjectOverview
                    project={selected}
                    features={projectFeatures}
                    metrics={metrics}
                    health={health}
                    snapshot={snapshot}
                    summary={summaries[selected.id] ?? null}
                  />
                )}

                {tab === "features" && (
                  <ProjectFeatures
                    features={projectFeatures}
                    onAdd={() => setDialog({ type: "feature", feature: null })}
                    onEdit={(feature) => setDialog({ type: "feature", feature })}
                    onComplete={(feature) =>
                      void library.patchFeature(feature.id, {
                        status: "completed",
                        completedAt: new Date().toISOString(),
                      })
                    }
                    onConvertToIssue={(feature) =>
                      void handleIssueDraft(
                        feature.title,
                        feature.description ?? "",
                        feature.acceptanceCriteria,
                      )
                    }
                    onDelete={(feature) =>
                      setDialog({
                        type: "confirm",
                        title: "Özelliği sil",
                        message: `"${feature.title}" silinecek.`,
                        onConfirm: () => {
                          void library.deleteFeature(feature.id);
                          closeDialog();
                        },
                      })
                    }
                  />
                )}

                {tab === "notes" && (
                  <ProjectNotes
                    notes={projectNotes}
                    features={projectFeatures}
                    aiAvailable={integrations.ai}
                    busyNoteId={busyNoteId}
                    onAdd={() => setDialog({ type: "note", note: null })}
                    onEdit={(note) => setDialog({ type: "note", note })}
                    onTogglePin={(note) =>
                      void library.patchNote(note.id, { pinned: !note.pinned })
                    }
                    onConvertToFeature={(note) => void handleNoteToFeature(note)}
                    onConvertToIssue={(note) =>
                      void handleIssueDraft(note.title, note.content, [])
                    }
                    onDelete={(note) =>
                      setDialog({
                        type: "confirm",
                        title: "Notu sil",
                        message: `"${note.title}" silinecek.`,
                        onConfirm: () => {
                          void library.deleteNote(note.id);
                          closeDialog();
                        },
                      })
                    }
                  />
                )}

                {tab === "tasks" && (
                  <ProjectTasks
                    tasks={projectTasks}
                    features={projectFeatures}
                    onCreate={(title, priority, relatedFeatureId) =>
                      void library.createTask(selected.id, {
                        title,
                        description: null,
                        completed: false,
                        priority: priority as FeaturePriority,
                        relatedFeatureId,
                        dueDate: null,
                      })
                    }
                    onToggle={(task) =>
                      void library.patchTask(task.id, { completed: !task.completed })
                    }
                    onDelete={(task) => void library.deleteTask(task.id)}
                  />
                )}

                {tab === "github" && (
                  <ProjectGithub
                    snapshot={snapshot}
                    connected={githubConnected && selected.githubFullName !== null}
                  />
                )}

                {tab === "activity" && <ProjectActivityFeed activities={projectActivities} />}

                {tab === "files" && <ProjectFiles snapshot={snapshot} />}

                {tab === "ai" && (
                  <ProjectAiAssistant
                    available={integrations.ai}
                    busy={aiBusy}
                    error={aiError}
                    summary={summaries[selected.id] ?? null}
                    roadmap={roadmap}
                    releaseNotes={releaseNotes}
                    onSummary={() => void handleSummary()}
                    onRoadmap={() => void handleRoadmap()}
                    onReleaseNotes={() => void handleReleaseNotes()}
                  />
                )}
              </ProjectDetail>
            ) : (
              <div className="rounded-card border border-dashed border-line-strong bg-surface p-10 text-center text-sm text-ink-soft">
                Soldan bir proje seç.
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Diyaloglar --- */}

      {dialog.type === "project" && (
        <ProjectFormModal
          project={dialog.project}
          // GitHub bağlıysa repo elle yazılmak yerine listeden seçilebilir
          installationId={githubConnected ? installationId : null}
          accessToken={library.accessToken}
          onSave={(input: ProjectInput) => {
            if (dialog.project) {
              void library.updateProject(dialog.project.id, input);
            } else {
              void library.createProject(input).then((created) => {
                if (created) setParam({ project: created.id, tab: "overview" });
              });
            }
            closeDialog();
          }}
          onClose={closeDialog}
        />
      )}

      {dialog.type === "feature" && selected && (
        <FeatureFormModal
          feature={dialog.feature}
          initial={dialog.initial}
          onSave={(input: FeatureInput) => {
            if (dialog.feature) void library.updateFeature(dialog.feature.id, input);
            else void library.createFeature(selected.id, input);
            closeDialog();
          }}
          onClose={closeDialog}
        />
      )}

      {dialog.type === "note" && selected && (
        <NoteFormModal
          note={dialog.note}
          features={projectFeatures}
          onSave={(input: NoteInput) => {
            if (dialog.note) void library.updateNote(dialog.note.id, input);
            else void library.createNote(selected.id, input);
            closeDialog();
          }}
          onClose={closeDialog}
        />
      )}

      {dialog.type === "github" && (
        <GithubConnectModal
          configured={integrations.github}
          missing={integrations.github ? [] : ["GITHUB_APP_ID", "GITHUB_PRIVATE_KEY", "GITHUB_APP_SLUG"]}
          onClose={closeDialog}
        />
      )}

      {dialog.type === "repos" && (
        <RepositoryPicker
          installationId={dialog.installationId}
          accessToken={library.accessToken}
          onPick={(repo) => {
            if (selected) {
              // Seçili projeye repo bağla
              void library.updateProject(selected.id, {
                name: selected.name,
                description: selected.description,
                status: selected.status,
                technologies: selected.technologies,
                githubFullName: repo.fullName,
              });
            } else {
              // Seçili proje yokken repo'dan yeni proje oluştur. Önceden bu
              // dal boştu: boş ekran "repository'den başla" diyordu ama
              // repo seçmek hiçbir şey yapmıyordu.
              void library
                .createProject({
                  name: repo.name,
                  description: repo.description,
                  status: "active",
                  // Dil bilgisi varsa ilk teknoloji olarak alınır; yoksa
                  // liste boş kalır, uydurulmaz.
                  technologies: repo.language ? [repo.language] : [],
                  githubFullName: repo.fullName,
                })
                .then((project) => {
                  if (project) setParam({ project: project.id });
                });
            }
            closeDialog();
          }}
          onClose={closeDialog}
        />
      )}

      {dialog.type === "confirm" && (
        <Modal title={dialog.title} titleId={confirmId} onClose={closeDialog}>
          <p className="text-ink-soft">{dialog.message}</p>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeDialog}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line px-4 font-medium text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={dialog.onConfirm}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-danger px-5 font-medium text-white transition-colors hover:brightness-95"
            >
              Sil
            </button>
          </div>
        </Modal>
      )}

      {draft && selected && (
        <AiDraftPreview
          preview={draft}
          creating={creatingIssue}
          onSaveFeature={(featureDraft) => {
            void library.createFeature(selected.id, {
              title: featureDraft.title,
              description: featureDraft.description,
              status: "planned",
              priority: featureDraft.priority,
              acceptanceCriteria: featureDraft.acceptanceCriteria,
              targetDate: null,
            });
            setDraft(null);
          }}
          onCreateIssueDraft={(featureDraft) => {
            setDraft(null);
            void handleIssueDraft(
              featureDraft.title,
              featureDraft.description,
              featureDraft.acceptanceCriteria,
            );
          }}
          onConfirmIssue={(issueDraft) => void handleConfirmIssue(issueDraft)}
          onClose={() => setDraft(null)}
        />
      )}
    </div>
  );
}
