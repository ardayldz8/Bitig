import type { Metadata } from "next";
import ReposPage from "@/components/repos/repos-page";
import { integrationsSnapshot } from "@/lib/env";

export const metadata: Metadata = {
  title: "Repolar",
  description: "GitHub repolarının durumu tek ekranda.",
};

export default function Repolar() {
  return <ReposPage integrations={integrationsSnapshot()} />;
}
