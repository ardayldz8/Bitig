import { Suspense } from "react";
import type { Metadata } from "next";
import ProjectsPage from "@/components/projects/projects-page";
import { integrationsSnapshot } from "@/lib/env";

export const metadata: Metadata = {
  title: "Projelerim",
  description: "Projelerini takip et, geliştirme sürecini organize et.",
};

export default function Projeler() {
  // Entegrasyon durumu sunucuda okunur; anahtarların kendisi istemciye GİTMEZ,
  // yalnızca "yapılandırıldı mı" bilgisi gönderilir.
  const integrations = integrationsSnapshot();

  return (
    <Suspense fallback={<div className="p-8 text-sm text-ink-soft">Yükleniyor…</div>}>
      <ProjectsPage integrations={integrations} />
    </Suspense>
  );
}
