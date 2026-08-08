import { NextResponse } from "next/server";
import { z } from "zod";
import { githubRequest } from "@/lib/github/client";
import { assertInstallationAccess } from "@/lib/github/ownership";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { createAdminClient, getUserId } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CI durumu YALNIZCA bu kadar gün içinde dokunulmuş repolar için çekilir.
 *
 * 400 gündür uyuyan bir repo'nun testinin yeşil olup olmadığı kimseyi
 * ilgilendirmiyor; her senkronda 37 ekstra istek atmak boşuna. Sınırın
 * altındakiler için ci_conclusion null kalır ve arayüz göstermez.
 */
const CI_GUN_SINIRI = 90;

type GhRepo = {
  full_name: string;
  private: boolean;
  fork: boolean;
  archived: boolean;
  language: string | null;
  description: string | null;
  html_url: string;
  pushed_at: string | null;
  open_issues_count: number;
};

const istekSemasi = z.object({ installationId: z.number().int().positive() });

export async function POST(request: Request) {
  const limit = checkRateLimit(clientKey(request, "repo-sync"), 6, 300_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Çok sık senkron istedin. Biraz bekle." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });
  }

  const parsed = istekSemasi.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const { installationId } = parsed.data;

  // Kurulum gerçekten bu kullanıcıya mı ait
  const sahiplik = await assertInstallationAccess(request, installationId);
  if (!sahiplik.ok) {
    return NextResponse.json({ error: sahiplik.error }, { status: sahiplik.status });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Sunucu yapılandırılmamış." }, { status: 503 });
  }

  // ------------------------------------------------------------ Repo listesi

  const repolar: GhRepo[] = [];
  try {
    // 100'er sayfa; kurulumdaki repo sayısı bunu aşarsa sayfalanır
    for (let sayfa = 1; sayfa <= 5; sayfa++) {
      const yanit = await githubRequest<{ repositories?: GhRepo[] }>(
        installationId,
        `/installation/repositories?per_page=100&page=${sayfa}`,
        { signal: request.signal },
      );
      const parca = yanit.repositories ?? [];
      repolar.push(...parca);
      if (parca.length < 100) break;
    }
  } catch {
    return NextResponse.json({ error: "Repository listesi alınamadı." }, { status: 502 });
  }

  // ------------------------------------------------- Taze repolar için detay

  const simdi = Date.now();
  const tazeMi = (repo: GhRepo) =>
    repo.pushed_at !== null &&
    (simdi - new Date(repo.pushed_at).getTime()) / 86_400_000 <= CI_GUN_SINIRI;

  const satirlar = await Promise.all(
    repolar.map(async (repo) => {
      let ciConclusion: string | null = null;
      let ciAt: string | null = null;
      let openPrs = 0;

      if (tazeMi(repo) && !repo.archived) {
        /*
         * İki istek: son iş akışı ve açık PR sayısı. Hata yutuluyor —
         * tek bir repo'nun CI'ı okunamadı diye tüm senkron düşmemeli;
         * o alanlar null kalır, arayüz boş gösterir.
         */
        try {
          const runs = await githubRequest<{
            workflow_runs?: { conclusion: string | null; updated_at: string }[];
          }>(installationId, `/repos/${repo.full_name}/actions/runs?per_page=1`, {
            signal: request.signal,
          });
          const run = runs.workflow_runs?.[0];
          if (run) {
            ciConclusion = run.conclusion;
            ciAt = run.updated_at;
          }
        } catch {
          // yok sayılır
        }

        try {
          const prs = await githubRequest<{ number: number }[]>(
            installationId,
            `/repos/${repo.full_name}/pulls?state=open&per_page=100`,
            { signal: request.signal },
          );
          openPrs = Array.isArray(prs) ? prs.length : 0;
        } catch {
          // yok sayılır
        }
      }

      return {
        user_id: userId,
        full_name: repo.full_name,
        is_private: repo.private,
        is_fork: repo.fork,
        is_archived: repo.archived,
        language: repo.language,
        description: repo.description,
        html_url: repo.html_url,
        pushed_at: repo.pushed_at,
        /*
         * GitHub'ın open_issues_count'u PR'ları da sayıyor. Gerçek issue
         * sayısı için PR'lar düşülüyor; aksi hâlde açık PR'ı olan bir repo
         * "issue'su var" gibi görünürdü.
         */
        open_issues: Math.max(0, repo.open_issues_count - openPrs),
        open_prs: openPrs,
        ci_conclusion: ciConclusion,
        ci_at: ciAt,
        synced_at: new Date().toISOString(),
      };
    }),
  );

  // Bu turun damgası: aşağıda "bu turda yazılmayanlar" bununla bulunacak
  const turDamgasi = new Date().toISOString();
  const damgali = satirlar.map((satir) => ({ ...satir, synced_at: turDamgasi }));

  const { error } = await admin
    .from("repo_snapshots")
    .upsert(damgali, { onConflict: "user_id,full_name" });

  if (error) {
    return NextResponse.json({ error: "Envanter kaydedilemedi." }, { status: 500 });
  }

  /*
   * Kurulumdan çıkarılan repolar silinir; aksi hâlde erişimi kaldırılmış bir
   * repo listede sonsuza kadar kalırdı.
   *
   * Ad listesiyle `not in` denenmedi: repo adları `/`, `.` ve `-` içeriyor ve
   * PostgREST'in in-filtresinde bunları güvenle kaçırmak kırılgan. Bu turda
   * yazılmayan satırı damgadan bulmak hem basit hem kaçış gerektirmiyor.
   */
  if (damgali.length > 0) {
    await admin
      .from("repo_snapshots")
      .delete()
      .eq("user_id", userId)
      .lt("synced_at", turDamgasi);
  }

  return NextResponse.json({
    synced: damgali.length,
    withCi: damgali.filter((satir) => satir.ci_conclusion !== null).length,
  });
}
