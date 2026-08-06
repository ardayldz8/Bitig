import { Suspense } from "react";
import type { Metadata } from "next";
import CaloriePage from "@/components/calorie/calorie-page";

export const metadata: Metadata = {
  title: "Kalori Takibi",
  description: "Yediklerini takip et, hedeflerine ulaş.",
};

export default function Kalori() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-ink-soft">Yükleniyor…</div>}>
      <CaloriePage />
    </Suspense>
  );
}
