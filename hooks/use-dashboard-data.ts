"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAuth } from "@/components/auth/auth-provider";
import { rowToManga, rowToMediaEntry, rowToFoodEntry, rowToTargets, type Row } from "@/lib/cloud/mappers";
import { dateKey, entriesForDate, sumTotals } from "@/lib/calorie/totals";
import { defaultTargets } from "@/types/calorie";
import type {
  DashboardData,
  DashboardRecentItem,
  ModuleResult,
} from "@/lib/dashboard/dashboard-types";

const EMPTY: DashboardData = {
  manga: { state: "empty" },
  calorie: { state: "empty" },
  media: { state: "empty" },
  projects: { state: "empty" },
  recentItems: [],
};

/** Bir modülün okuması patlarsa yalnızca o modül "error" olur. */
async function safe<T>(
  read: () => Promise<ModuleResult<T>>,
  message: string,
): Promise<ModuleResult<T>> {
  try {
    return await read();
  } catch {
    return { state: "error", message };
  }
}

/** Sorgu hatası sessizce boş liste dönmesin — modül "error" olarak işaretlensin. */
function unwrap(result: { data: unknown; error: { message: string } | null }): Row[] {
  if (result.error) throw new Error(result.error.message);
  return Array.isArray(result.data) ? (result.data as Row[]) : [];
}

/**
 * Ana sayfa veri adaptörü.
 *
 * Veriler artık her modülün kendi tablosundan okunur. Hiçbir modül için ayrı
 * bir "son durum" tablosu tutulmaz; özet, asıl kayıtlardan türetilir.
 */
export function useDashboardData(): { data: DashboardData; loading: boolean } {
  const { client, userId, status } = useAuth();
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "signed_in" || !client || !userId) {
      setData(EMPTY);
      setLoading(status === "loading");
      return;
    }

    let cancelled = false;

    async function load(supabase: SupabaseClient, uid: string) {
      const recent: DashboardRecentItem[] = [];

      // --- Manga ---
      const manga = await safe<{ title: string; currentChapter: number }>(async () => {
        const rows = unwrap(
          await supabase
            .from("mangas")
            .select("*")
            .eq("user_id", uid)
            .eq("status", "reading")
            .order("updated_at", { ascending: false })
            .limit(1),
        );

        const current = rows.map(rowToManga).find((item) => item !== null);
        if (!current) return { state: "empty" };

        recent.push({
          id: `manga-${current.id}`,
          module: "manga",
          title: current.name,
          subtitle: `${current.currentChapter}. bölüm`,
          href: "/manga",
          updatedAt: typeof rows[0].updated_at === "string" ? rows[0].updated_at : null,
        });

        return {
          state: "ok",
          data: { title: current.name, currentChapter: current.currentChapter },
        };
      }, "Manga bilgisi yüklenemedi");

      // --- Kalori ---
      const calorie = await safe<{ consumed: number; target: number }>(async () => {
        const today = dateKey(new Date());

        // Gün sınırı kullanıcının saat dilimine göre; sorguyu geniş tutup
        // filtrelemeyi mevcut yardımcıya bırakmak sapma üretmez.
        const dayStart = new Date(`${today}T00:00:00`);
        const dayEnd = new Date(dayStart.getTime() + 36 * 60 * 60 * 1000);

        const [entryResult, targetResult] = await Promise.all([
          supabase
            .from("food_entries")
            .select("*")
            .eq("user_id", uid)
            .gte("consumed_at", new Date(dayStart.getTime() - 12 * 60 * 60 * 1000).toISOString())
            .lte("consumed_at", dayEnd.toISOString()),
          supabase.from("nutrition_targets").select("*").eq("user_id", uid).maybeSingle(),
        ]);

        const entries = unwrap(entryResult)
          .map(rowToFoodEntry)
          .filter((entry) => entry !== null);
        const todays = entriesForDate(entries, today);
        if (todays.length === 0) return { state: "empty" };

        if (targetResult.error) throw new Error(targetResult.error.message);
        const targets = targetResult.data
          ? (rowToTargets(targetResult.data as Row) ?? defaultTargets)
          : defaultTargets;

        return {
          state: "ok",
          data: { consumed: sumTotals(todays).calories, target: targets.calories },
        };
      }, "Bugünkü kalori bilgisi alınamadı");

      // --- Dizi / Film ---
      const media = await safe<{
        title: string;
        mediaType: "series" | "movie";
        currentSeason: number | null;
        currentEpisode: number | null;
      }>(async () => {
        const rows = unwrap(
          await supabase
            .from("media_entries")
            .select("*")
            .eq("user_id", uid)
            .in("status", ["watching", "planned"])
            .order("updated_at", { ascending: false }),
        );

        const list = rows.map(rowToMediaEntry).filter((item) => item !== null);
        // Önce izlenen, yoksa planlanan
        const current =
          list.find((item) => item.status === "watching") ??
          list.find((item) => item.status === "planned");
        if (!current) return { state: "empty" };

        const position =
          current.mediaType === "series" && current.currentSeason !== null
            ? `${current.currentSeason}. Sezon ${current.currentEpisode ?? 1}. Bölüm`
            : "Film";

        recent.push({
          id: `media-${current.id}`,
          module: "media",
          title: current.title,
          subtitle: position,
          href: "/dizi-film",
          updatedAt: current.updatedAt,
        });

        return {
          state: "ok",
          data: {
            title: current.title,
            mediaType: current.mediaType,
            currentSeason: current.currentSeason,
            currentEpisode: current.currentEpisode,
          },
        };
      }, "Dizi / film bilgisi yüklenemedi");

      // --- Projeler ---
      const projects = await safe<{
        id: string;
        name: string;
        status: string;
        updatedAt: string | null;
        ciStatus: "success" | "failure" | "pending" | null;
        openIssues: number | null;
      }>(async () => {
        const rows = unwrap(
          await supabase
            .from("projects")
            .select("id, name, status, updated_at")
            .eq("user_id", uid)
            .order("updated_at", { ascending: false })
            .limit(10),
        );

        const current =
          rows.find((row) => row.status === "active") ?? rows[0] ?? null;
        if (!current || typeof current.id !== "string" || typeof current.name !== "string") {
          return { state: "empty" };
        }

        const updatedAt =
          typeof current.updated_at === "string" ? current.updated_at : null;

        // GitHub durumu senkronizasyonda kaydedilen tablolardan okunur.
        // Ana sayfa GitHub'a istek ATMAZ; yalnızca son bilinen durumu gösterir.
        const [runResult, issueResult] = await Promise.all([
          supabase
            .from("github_workflow_runs")
            .select("status, conclusion")
            .eq("project_id", current.id)
            .order("started_at", { ascending: false })
            .limit(1),
          supabase
            .from("github_issues")
            .select("id", { count: "exact", head: true })
            .eq("project_id", current.id)
            .eq("state", "open"),
        ]);

        // Senkronize edilmemiş proje için hata değil, "bilinmiyor" doğru cevap
        const lastRun = unwrap(runResult)[0] ?? null;
        const ciStatus = lastRun
          ? lastRun.status !== "completed"
            ? ("pending" as const)
            : lastRun.conclusion === "success"
              ? ("success" as const)
              : lastRun.conclusion === null
                ? null
                : ("failure" as const)
          : null;

        const openIssues = issueResult.error ? null : (issueResult.count ?? null);

        recent.push({
          id: `project-${current.id}`,
          module: "projects",
          title: current.name,
          subtitle: "Son güncelleme yapıldı",
          href: `/projeler?project=${encodeURIComponent(current.id)}`,
          updatedAt,
        });

        return {
          state: "ok",
          data: {
            id: current.id,
            name: current.name,
            status: typeof current.status === "string" ? current.status : "active",
            updatedAt,
            ciStatus,
            openIssues,
          },
        };
      }, "Proje bilgisi şu anda kullanılamıyor");

      if (cancelled) return;

      // Zamanı bilinenler önce, en yeni en üstte; zamansızlar sona
      const recentItems = recent
        .sort((a, b) => {
          if (a.updatedAt && b.updatedAt) return b.updatedAt.localeCompare(a.updatedAt);
          if (a.updatedAt) return -1;
          if (b.updatedAt) return 1;
          return 0;
        })
        .slice(0, 3);

      setData({ manga, calorie, media, projects, recentItems });
      setLoading(false);
    }

    void load(client, userId);

    return () => {
      cancelled = true;
    };
  }, [client, userId, status]);

  return { data, loading };
}
