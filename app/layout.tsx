import type { Metadata, Viewport } from "next";
import SiteNav from "@/components/ui/site-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bitig — Manga Takibi",
  description: "Okuduğun mangaları ve kaldığın bölümü takip et.",
};

export const viewport: Viewport = {
  themeColor: "#7c5cf5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body className="min-h-dvh antialiased">
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
