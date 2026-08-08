"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ExternalLink,
  GitPullRequest,
  Lock,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useGithubInstallation } from "@/hooks/use-github-installation";
import { useRepoInventory } from "@/hooks/use-repo-inventory";
import {
  DECISION_LABELS,
  daysSincePush,
  groupOf,
  sortByAttention,
  summarize,
  type RepoGroup,
  type RepoWithTriage,
  type TriageDecision,
} from "@/lib/repos/inventory";
import type { IntegrationsSnapshot } from "@/lib/env";

const GRUP_BASLIK: Record<RepoGroup, string> = {
  aktif: "Aktif",
  duraklamis: "Duraklamış",
  bayat: "Bayat",
};

const GRUP_ACIKLAMA: Record<RepoGroup, string> = {
  aktif: "son 30 gün",
  duraklamis: "30–90 gün",
  bayat: "90 günden eski",
};

export default function ReposPage({ integrations }: { integrations: IntegrationsSnapshot }) {
  const inventory = useRepoInventory();
  const { session } = useAuth();
  const [senkron, setSenkron] = useState<"idle" | "busy" | "error">("idle");
  const [senkronNot, setSenkronNot] = useState<string | null>(null);
  const [gizliKararlar, setGizliKararlar] = useState(true);

  const github = useGithubInstallation({
    enabled: integrations.github,
    mode: session ? "cloud" : "needs_auth",
    accessToken: session?.access_token ?? null,
    pendingInstallationId: null,
    onConsumed: () => undefined,
  });

  const installationId = github.installation?.installationId ?? null;
  const simdi = useMemo(() => new Date(), []);

  const ozet = useMemo(() => summarize(inventory.repos, simdi), [inventory.repos, simdi]);

  /** Karar verilmişler varsayılan olarak gizli — liste onlarla dolmasın. */
  const gorunen = useMemo(() => {
    const suzulmus = gizliKararlar
      ? inventory.repos.filter(
          (repo) => repo.decision !== "done" && repo.decision !== "junk",
        )
      : inventory.repos;
    return sortByAttention(suzulmus, simdi);
  }, [inventory.repos, gizliKararlar, simdi]);

  const gruplu = useMemo(() => {
    const map = new Map<RepoGroup, RepoWithTriage[]>([
      ["aktif", []],
      ["duraklamis", []],
      ["bayat", []],
    ]);
    for (const repo of gorunen) map.get(groupOf(repo, simdi))!.push(repo);
    return map;
  }, [gorunen, simdi]);

  const senkronla = async () => {
    if (installationId === null || !session?.access_token) return;
    setSenkron("busy");
    setSenkronNot(null);
    try {
      const response = await fetch("/api/repos/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ installationId }),
      });
      const payload = (await response.json()) as {
        synced?: number;
        withCi?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "Senkron başarısız.");
      setSenkronNot(`${payload.synced} repo güncellendi.`);
      await inventory.reload();
      setSenkron("idle");
    } catch (error) {
      setSenkron("error");
      setSenkronNot(error instanceof Error ? error.message : "Senkron başarısız.");
    }
  };

  return (
    <main className="mx-auto max-w-[1100px] px-4 pb-12 pt-6 sm:px-6">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold text-ink">Repolar</h1>
        <p className="mt-1 text-sm text-ink-soft">
          GitHub&apos;daki tüm repoların tek ekranda. Uygulama yalnızca okur —
          repolarına hiçbir şey yazmaz.
        </p>
      </header>

      {!integrations.github && (
        <p className="mb-5 rounded-xl border border-line bg-canvas px-4 py-3 text-sm text-ink-soft">
          GitHub bağlantısı yapılandırılmamış.
        </p>
      )}

      {integrations.github && installationId === null && (
        <p className="mb-5 rounded-xl border border-line bg-canvas px-4 py-3 text-sm text-ink-soft">
          GitHub kurulumu bulunamadı. Uygulamayı hesabına kurman gerekiyor.
        </p>
      )}

      {ozet.toplam > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Kutu deger={ozet.aktif} etiket="aktif" />
          <Kutu deger={ozet.duraklamis} etiket="duraklamış" />
          <Kutu deger={ozet.kararsizBayat} etiket="karar bekliyor" vurgu={ozet.kararsizBayat > 0} />
          <Kutu deger={ozet.kirikCi} etiket="CI kırık" tehlike={ozet.kirikCi > 0} />
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void senkronla()}
          disabled={senkron === "busy" || installationId === null}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-strong disabled:opacity-50"
        >
          <RefreshCw size={16} className={senkron === "busy" ? "animate-spin" : ""} aria-hidden="true" />
          {senkron === "busy" ? "Çekiliyor…" : "GitHub'dan çek"}
        </button>

        <button
          type="button"
          onClick={() => setGizliKararlar((g) => !g)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm font-medium text-ink-soft transition-colors hover:border-brand hover:text-brand"
        >
          {gizliKararlar ? "Kapatılanları göster" : "Kapatılanları gizle"}
        </button>

        {senkronNot && (
          <span className={`text-sm ${senkron === "error" ? "text-danger" : "text-ink-soft"}`}>
            {senkronNot}
          </span>
        )}
      </div>

      {inventory.error && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {inventory.error}
        </p>
      )}

      {!inventory.hydrated && <p className="text-sm text-ink-soft">Yükleniyor…</p>}

      {inventory.hydrated && ozet.toplam === 0 && (
        <p className="rounded-2xl border border-dashed border-line-strong px-4 py-10 text-center text-sm text-ink-soft">
          Henüz envanter yok. &ldquo;GitHub&apos;dan çek&rdquo; ile başla.
        </p>
      )}

      {(["aktif", "duraklamis", "bayat"] as RepoGroup[]).map((grup) => {
        const liste = gruplu.get(grup) ?? [];
        if (liste.length === 0) return null;

        return (
          <section key={grup} className="mb-6">
            <h2 className="mb-2 flex items-baseline gap-2 text-base font-semibold text-ink">
              {GRUP_BASLIK[grup]}
              <span className="text-xs font-normal text-ink-soft">
                {GRUP_ACIKLAMA[grup]} · {liste.length}
              </span>
            </h2>
            <ul className="space-y-2">
              {liste.map((repo) => (
                <RepoSatiri
                  key={repo.fullName}
                  repo={repo}
                  gun={daysSincePush(repo, simdi)}
                  onDecision={(karar) => inventory.setDecision(repo.fullName, karar)}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}

function Kutu({
  deger,
  etiket,
  vurgu,
  tehlike,
}: {
  deger: number;
  etiket: string;
  vurgu?: boolean;
  tehlike?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${
        tehlike ? "border-danger bg-danger-soft" : vurgu ? "border-brand bg-brand-soft" : "border-line bg-surface"
      }`}
    >
      <p
        className={`text-xl font-semibold tabular-nums ${
          tehlike ? "text-danger" : vurgu ? "text-brand" : "text-ink"
        }`}
      >
        {deger}
      </p>
      <p className="text-xs text-ink-soft">{etiket}</p>
    </div>
  );
}

const KARARLAR: TriageDecision[] = ["active", "someday", "done", "junk"];

function RepoSatiri({
  repo,
  gun,
  onDecision,
}: {
  repo: RepoWithTriage;
  gun: number | null;
  onDecision: (karar: TriageDecision | null) => void;
}) {
  const [acik, setAcik] = useState(false);
  const kirikCi = repo.ciConclusion === "failure";

  return (
    <li className={`rounded-xl border bg-surface p-3 ${kirikCi ? "border-danger" : "border-line"}`}>
      <div className="flex items-start gap-2">
        <button type="button" onClick={() => setAcik((a) => !a)} className="min-w-0 flex-1 text-left">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-ink">{repo.fullName}</span>
            {repo.isPrivate && <Lock size={11} className="shrink-0 text-ink-soft" aria-label="Özel" />}
            {repo.isArchived && (
              <Archive size={11} className="shrink-0 text-ink-soft" aria-label="Arşivlenmiş" />
            )}
          </span>

          <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-ink-soft">
            <span>{gun === null ? "hiç push yok" : `${gun} gün önce`}</span>
            {repo.language && <span>{repo.language}</span>}
            {repo.openPrs > 0 && (
              <span className="inline-flex items-center gap-1 font-medium text-brand">
                <GitPullRequest size={11} aria-hidden="true" />
                {repo.openPrs} PR
              </span>
            )}
            {repo.openIssues > 0 && <span>{repo.openIssues} issue</span>}
            {kirikCi && (
              <span className="inline-flex items-center gap-1 font-medium text-danger">
                <AlertTriangle size={11} aria-hidden="true" />
                CI kırık
              </span>
            )}
            {repo.ciConclusion === "success" && (
              <CheckCircle2 size={11} className="text-ok" aria-label="CI başarılı" />
            )}
          </span>

          {repo.decision && (
            <span className="mt-1 inline-block rounded-full bg-canvas px-2 py-0.5 text-[11px] text-ink-soft">
              {DECISION_LABELS[repo.decision]}
            </span>
          )}
        </button>

        {repo.htmlUrl && (
          <a
            href={repo.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${repo.fullName} GitHub'da aç`}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-soft transition-colors hover:text-brand"
          >
            <ExternalLink size={15} />
          </a>
        )}
      </div>

      {acik && (
        <div className="mt-3 border-t border-line pt-3">
          {repo.description && (
            <p className="mb-2 text-xs text-ink-soft">{repo.description}</p>
          )}

          <p className="mb-1.5 text-xs font-medium text-ink">Bu repo ne durumda?</p>
          <div className="flex flex-wrap gap-1.5">
            {KARARLAR.map((karar) => (
              <button
                key={karar}
                type="button"
                aria-pressed={repo.decision === karar}
                onClick={() => onDecision(repo.decision === karar ? null : karar)}
                className={`min-h-9 rounded-lg border px-2.5 text-xs font-medium transition-colors ${
                  repo.decision === karar
                    ? "border-brand bg-brand text-white"
                    : "border-line text-ink-soft hover:border-brand hover:text-brand"
                }`}
              >
                {DECISION_LABELS[karar]}
              </button>
            ))}
          </div>

          {/*
            Arşivleme/silme bilerek uygulamada YOK: GitHub jetonu salt okunur.
            Karar burada tutulur, işlem GitHub'da kullanıcı tarafından yapılır.
          */}
          {(repo.decision === "done" || repo.decision === "junk") && repo.htmlUrl && (
            <p className="mt-2.5 flex items-center gap-1.5 text-xs text-ink-soft">
              <Trash2 size={12} aria-hidden="true" />
              Gerçekten arşivlemek/silmek için{" "}
              <a
                href={`${repo.htmlUrl}/settings`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand underline"
              >
                GitHub ayarları
              </a>
              — uygulama repona dokunmaz.
            </p>
          )}
        </div>
      )}
    </li>
  );
}
