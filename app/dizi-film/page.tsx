import type { Metadata } from "next";
import MediaPage from "@/components/media/media-page";

export const metadata: Metadata = {
  title: "Dizi / Film Takibi — Bitig",
  description: "İzlediklerini takip et, hiçbir şeyi unutma.",
};

export default function DiziFilm() {
  return <MediaPage />;
}
