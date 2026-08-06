"use client";

import DashboardSkeleton from "@/components/dashboard/dashboard-skeleton";
import ModuleGrid from "@/components/dashboard/module-grid";
import RecentItems from "@/components/dashboard/recent-items";
import { useDashboardData } from "@/hooks/use-dashboard-data";

/**
 * Ana sayfanın istemci bölümü — yalnızca localStorage'a ihtiyaç duyan
 * özet alanlarını kapsar. Başlık ve hızlı işlemler sunucu bileşenidir.
 */
export default function DashboardPage() {
  const { data, loading } = useDashboardData();

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-4">
      <ModuleGrid data={data} />
      <RecentItems items={data.recentItems} />
    </div>
  );
}
