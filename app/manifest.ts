import type { MetadataRoute } from "next";

/** /manifest.webmanifest olarak servis edilir (Next App Router). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bitig — Kişisel Takip",
    short_name: "Bitig",
    description:
      "Manga, kalori, dizi/film ve yazılım projelerini tek yerden takip et.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf8fd",
    theme_color: "#7c5cf5",
    lang: "tr",
    dir: "ltr",
    categories: ["productivity", "lifestyle", "utilities"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Manga Takibi", short_name: "Manga", url: "/manga" },
      { name: "Kalori Takibi", short_name: "Kalori", url: "/kalori" },
      { name: "Dizi / Film", short_name: "Dizi", url: "/dizi-film" },
      { name: "Projelerim", short_name: "Projeler", url: "/projeler" },
    ],
  };
}
