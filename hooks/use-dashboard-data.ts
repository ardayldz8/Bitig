"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAuth } from "@/components/auth/auth-provider";
import { rowToManga, rowToMediaEntry, type Row } from "@/lib/cloud/mappers";
import type {
  DashboardData,
  DashboardRecentItem,
  ModuleResult,
} from "@/lib/dashboard/dashboard-types";

const EMPTY: DashboardData = {
  manga: { state: "empty" },
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

      // --- Repolar ---
      /*
       * Proje modülü kaldırıldı; kart artık repo envanterinden besleniyor.
       * Ana sayfa GitHub'a istek ATMAZ — yalnızca son senkronun sonucunu
       * okur, o da salt okunur bir kopyadır.
       */
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
            .from("repo_snapshots")
            .select("full_name, pushed_at, open_issues, open_prs, ci_conclusion")
            .eq("user_id", uid)
            .order("pushed_at", { ascending: false, nullsFirst: false })
            .limit(20),
        );

        if (rows.length === 0) return { state: "empty" };

        // Kırık CI varsa o öne çıkar; yoksa en son dokunulan repo
        const kirik = rows.find((row) => row.ci_conclusion === "failure");
        const current = kirik ?? rows[0];
        const fullName = typeof current.full_name === "string" ? current.full_name : null;
        if (!fullName) return { state: "empty" };

        const updatedAt = typeof current.pushed_at === "string" ? current.pushed_at : null;
        const ciStatus =
          current.ci_conclusion === "success"
            ? ("success" as const)
            : current.ci_conclusion === "failure"
              ? ("failure" as const)
              : current.ci_conclusion === null
                ? null
                : ("pending" as const);

        recent.push({
          id: `repo-${fullName}`,
          module: "projects",
          title: fullName,
          subtitle: kirik ? "CI kırık" : "Son dokunulan repo",
          href: "/repolar",
          updatedAt,
        });

        return {
          state: "ok",
          data: {
            id: fullName,
            name: fullName,
            status: "active",
            updatedAt,
            ciStatus,
            openIssues:
              typeof current.open_issues === "number" ? current.open_issues : null,
          },
        };
      }, "Repo bilgisi şu anda kullanılamıyor");

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

      setData({ manga, media, projects, recentItems });
      setLoading(false);
    }

    void load(client, userId);

    return () => {
      cancelled = true;
    };
  }, [client, userId, status]);

  return { data, loading };
}
