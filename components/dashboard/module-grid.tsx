"use client";

import { BookOpen, Clapperboard, Code2 } from "lucide-react";
import ModuleCard from "@/components/dashboard/module-card";
import { relativeDayLabel } from "@/lib/dashboard/dashboard-utils";
import type { DashboardData, ModuleResult } from "@/lib/dashboard/dashboard-types";

const TINTS = {
  manga: { bg: "bg-brand-soft", text: "text-brand", bar: "bg-brand" },
  media: { bg: "bg-amber-50", text: "text-amber-600", bar: "bg-amber-500" },
  projects: { bg: "bg-sky-50", text: "text-sky-600", bar: "bg-sky-500" },
} as const;

/** Bir modül boş ya da hatalıysa kart yine ilgili sayfaya yönlendirir. */
function fallbackText<T>(
  result: ModuleResult<T>,
  emptyText: string,
): { primary: string; secondary: null } | null {
  if (result.state === "ok") return null;
  return {
    primary: result.state === "error" ? result.message : emptyText,
    secondary: null,
  };
}

export default function ModuleGrid({ data }: { data: DashboardData }) {
  const mangaFallback = fallbackText(data.manga, "Henüz devam eden manga yok");
  const mediaFallback = fallbackText(data.media, "Henüz yapım eklenmedi");
  const projectFallback = fallbackText(data.projects, "Proje bilgisi için giriş yap");

  return (
    <section aria-label="Modüller">
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <li>
          <ModuleCard
            href="/manga"
            title="Manga Takibi"
            description="Okuduğun mangaları yönet ve ilerlemeni takip et."
            Icon={BookOpen}
            tint={TINTS.manga}
            primary={mangaFallback?.primary ?? (data.manga.state === "ok" ? data.manga.data.title : "")}
            secondary={
              mangaFallback
                ? null
                : data.manga.state === "ok"
                  ? `${data.manga.data.currentChapter}. bölüm`
                  : null
            }
            // Toplam bölüm bilgisi tutulmadığı için yüzde üretilmez
            ratio={null}
          />
        </li>

        <li>
          <ModuleCard
            href="/dizi-film"
            title="Dizi / Film"
            description="İzlediğin dizi ve filmleri kaydet ve puanla."
            Icon={Clapperboard}
            tint={TINTS.media}
            primary={mediaFallback?.primary ?? (data.media.state === "ok" ? data.media.data.title : "")}
            secondary={
              mediaFallback || data.media.state !== "ok"
                ? null
                : data.media.data.mediaType === "series" &&
                    data.media.data.currentSeason !== null
                  ? `${data.media.data.currentSeason}. Sezon ${data.media.data.currentEpisode ?? 1}. Bölüm`
                  : "Film"
            }
            // Sezon başına bölüm dağılımı bilinmediği için yüzde üretilmez
            ratio={null}
          />
        </li>

        <li>
          <ModuleCard
            href="/repolar"
            title="Projelerim"
            description="GitHub repolarının durumu: aktif, duraklamış, bayat."
            Icon={Code2}
            tint={TINTS.projects}
            primary={projectFallback?.primary ?? (data.projects.state === "ok" ? data.projects.data.name : "")}
            secondary={
              projectFallback || data.projects.state !== "ok"
                ? null
                : (() => {
                    const { ciStatus, openIssues, updatedAt } = data.projects.data;

                    // Öncelik sırası: bozuk CI > açık issue > son güncelleme.
                    // Dikkat isteyen bilgi, bilgilendirici olanın önüne geçer.
                    if (ciStatus === "failure") return "CI başarısız";
                    if (ciStatus === "pending") return "CI çalışıyor";
                    if (openIssues !== null && openIssues > 0) {
                      return `${openIssues} açık issue`;
                    }

                    const label = relativeDayLabel(updatedAt);
                    return label ? `Son güncelleme: ${label}` : null;
                  })()
            }
            ratio={null}
          />
        </li>
      </ul>

    </section>
  );
}
