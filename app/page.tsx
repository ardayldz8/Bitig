import type { Metadata } from "next";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import DashboardPage from "@/components/dashboard/dashboard-page";
import QuickActions from "@/components/dashboard/quick-actions";

export const metadata: Metadata = {
  title: { absolute: "Bitig" },
  description: "Manga, kalori, dizi/film ve proje takibin tek yerde.",
};

/** Sunucu bileşeni; veri gerektiren bölümler ayrı istemci bileşenlerinde. */
export default function Home() {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-[1100px] px-4 pt-8 pb-16 sm:px-6 sm:pt-10">
      <DashboardHeader />

      <div className="mt-8 space-y-4">
        <DashboardPage />
        <QuickActions />
      </div>
    </div>
  );
}
