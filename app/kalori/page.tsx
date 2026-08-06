import type { Metadata } from "next";
import CaloriePage from "@/components/calorie/calorie-page";

export const metadata: Metadata = {
  title: "Kalori Takibi — Bitig",
  description: "Yediklerini takip et, hedeflerine ulaş.",
};

export default function Kalori() {
  return <CaloriePage />;
}
