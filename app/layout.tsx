import type { Metadata, Viewport } from "next";
import PwaRegister from "@/components/ui/pwa-register";
import SiteNav from "@/components/ui/site-nav";
import "./globals.css";

/**
 * OG/Twitter görsellerinin mutlak adrese çözülmesi için taban URL.
 * Netlify derlemede `URL` değişkenini sağlar; yerelde localhost'a düşer.
 */
const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Bitig",
    template: "%s — Bitig",
  },
  description: "Manga, kalori, dizi/film ve yazılım projelerini tek yerden takip et.",
  applicationName: "Bitig",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  // iOS'ta ana ekrana eklendiğinde tam ekran uygulama gibi açılsın
  appleWebApp: {
    capable: true,
    title: "Bitig",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "Bitig",
    description: "Manga, kalori, dizi/film ve yazılım projelerini tek yerden takip et.",
    images: ["/og-image.png"],
    type: "website",
    locale: "tr_TR",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#7c5cf5",
  width: "device-width",
  initialScale: 1,
  // Kullanıcı yakınlaştırabilsin (erişilebilirlik) — maximumScale kısıtlanmaz
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      {/*
        Dar ekranda üst şerit yok: içerik çentiğin altına girmesin diye üstte
        safe-area kadar boşluk bırakılır. Altta ise sabit sekme çubuğunun
        yüksekliği ayrılır, yoksa sayfanın son satırı çubuğun arkasında kalır.
      */}
      <body className="min-h-dvh pt-[env(safe-area-inset-top)] pb-[calc(3.5rem+env(safe-area-inset-bottom))] antialiased sm:pt-0 sm:pb-0">
        <SiteNav />
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
