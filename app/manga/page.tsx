import { Suspense } from "react";
import type { Metadata } from "next";
import MangaPage from "@/components/manga/manga-page";

export const metadata: Metadata = {
  title: "Manga Takibi",
  description: "Okuduklarını takip et, bölümünü unutma.",
};

export default function Manga() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-ink-soft">Yükleniyor…</div>}>
      <MangaPage />
    </Suspense>
  );
}
