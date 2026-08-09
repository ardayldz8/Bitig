import type { Metadata } from "next";
import StatsPage from "@/components/stats/stats-page";

export const metadata: Metadata = {
  title: "İstatistikler",
  description: "Okuma hızı, izleme dağılımı ve abonelik gideri.",
};

export default function Istatistik() {
  return <StatsPage />;
}
