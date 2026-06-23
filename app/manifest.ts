import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bitig — kişisel takip",
    short_name: "Bitig",
    description: "Yapay zeka destekli kişisel günlük takip",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a1430",
    theme_color: "#6366f1",
    lang: "tr",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
