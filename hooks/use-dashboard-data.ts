"use client";

import { useEffect, useState } from "react";
import { initialMangas } from "@/lib/manga";
import { readStoredMangas } from "@/lib/storage";
import { readEntries, readTargets } from "@/lib/calorie/storage";
import { dateKey, entriesForDate, sumTotals } from "@/lib/calorie/totals";
import { createInitialEntries, readMediaEntries } from "@/lib/media/storage";
import { createSeedState, readProjectsState } from "@/lib/projects/store";
import { isSupabaseConfigured } from "@/lib/supabase/client";
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
function safe<T>(read: () => ModuleResult<T>, message: string): ModuleResult<T> {
  try {
    return read();
  } catch {
    return { state: "error", message };
  }
}

/**
 * Ana sayfa veri adaptörü.
 *
 * Hiçbir yeni localStorage anahtarı TANIMLAMAZ — her modülün kendi
 * storage katmanından export edilen okuma fonksiyonlarını kullanır.
 * Veriler yalnızca mount sonrası okunur → hydration uyuşmazlığı olmaz.
 */
export function useDashboardData(): { data: DashboardData; loading: boolean } {
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const recent: DashboardRecentItem[] = [];

    // --- Manga (lib/storage.ts) ---
    const manga = safe<{ title: string; currentChapter: number }>(() => {
      const list = readStoredMangas() ?? initialMangas;
      // Manga tipinde updatedAt yok; yeni kayıtlar başa eklendiği için
      // dizi sırası "en son" için tek dürüst göstergedir.
      const current = list.find((item) => item.status === "reading");
      if (!current) return { state: "empty" };

      recent.push({
        id: `manga-${current.id}`,
        module: "manga",
        title: current.name,
        subtitle: `${current.currentChapter}. bölüm`,
        href: "/manga",
        updatedAt: null, // gerçek zaman bilgisi yok → saat gösterilmez
      });

      return {
        state: "ok",
        data: { title: current.name, currentChapter: current.currentChapter },
      };
    }, "Manga bilgisi yüklenemedi");

    // --- Kalori (lib/calorie/storage.ts + totals.ts) ---
    const calorie = safe<{ consumed: number; target: number }>(() => {
      const today = dateKey(new Date());
      const todays = entriesForDate(readEntries(), today);
      const targets = readTargets();

      if (todays.length === 0) return { state: "empty" };
      return {
        state: "ok",
        data: { consumed: sumTotals(todays).calories, target: targets.calories },
      };
    }, "Bugünkü kalori bilgisi alınamadı");

    // --- Dizi / Film (lib/media/storage.ts) ---
    const media = safe<{
      title: string;
      mediaType: "series" | "movie";
      currentSeason: number | null;
      currentEpisode: number | null;
    }>(() => {
      const list = readMediaEntries() ?? createInitialEntries();
      const byRecent = [...list].sort((a, b) =>
        (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
      );
      // Önce izlenen, yoksa planlanan
      const current =
        byRecent.find((item) => item.status === "watching") ??
        byRecent.find((item) => item.status === "planned");
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
        updatedAt: current.updatedAt ?? null,
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

    // --- Projeler (lib/projects/store.ts) ---
    const projects = safe<{
      id: string;
      name: string;
      status: string;
      updatedAt: string | null;
      ciStatus: "success" | "failure" | "pending" | null;
      openIssues: number | null;
    }>(() => {
      // Supabase yapılandırılmışsa veriler oturuma bağlıdır; ana sayfa
      // oturum açmaz ve GitHub/Supabase çağrısı YAPMAZ.
      if (isSupabaseConfigured()) {
        return { state: "empty" };
      }

      const stored = readProjectsState() ?? createSeedState();
      const byRecent = [...stored.projects].sort((a, b) =>
        (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
      );
      const current =
        byRecent.find((item) => item.status === "active") ?? byRecent[0] ?? null;
      if (!current) return { state: "empty" };

      recent.push({
        id: `project-${current.id}`,
        module: "projects",
        title: current.name,
        subtitle: "Son güncelleme yapıldı",
        href: `/projeler?project=${encodeURIComponent(current.id)}`,
        updatedAt: current.updatedAt ?? null,
      });

      return {
        state: "ok",
        data: {
          id: current.id,
          name: current.name,
          status: current.status,
          updatedAt: current.updatedAt ?? null,
          // Ana sayfada GitHub çağrısı yapılmadığı için CI durumu bilinmez
          ciStatus: null,
          openIssues: null,
        },
      };
    }, "Proje bilgisi şu anda kullanılamıyor");

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
  }, []);

  return { data, loading };
}
