"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Clapperboard,
  CreditCard,
  Flame,
  FolderGit2,
  Home,
  Menu,
  NotebookPen,
  X,
} from "lucide-react";

const LINKS = [
  { href: "/", label: "Ana Sayfa", Icon: Home },
  { href: "/manga", label: "Manga", Icon: BookOpen },
  { href: "/kalori", label: "Kalori", Icon: Flame },
  { href: "/dizi-film", label: "Dizi / Film", Icon: Clapperboard },
  { href: "/projeler", label: "Projeler", Icon: FolderGit2 },
  { href: "/notlar", label: "Notlar", Icon: NotebookPen },
  { href: "/abonelikler", label: "Abonelikler", Icon: CreditCard },
] as const;

/**
 * Sağ üstte tek bir açılır menü — hem dar hem geniş ekranda.
 *
 * Önce üstte yatay şerit + altta sekme çubuğu vardı. Sayfa sayısı yediye
 * çıkınca ikisi de sığmıyor: 375 px'lik ekranda alt çubukta sekme başına
 * ~53 px kalıyor ve etiketler okunamayacak kadar kısalıyordu. Açılır menü
 * sayfa sayısından bağımsız çalışıyor.
 *
 * Bağlantılar `prefetch`: menü açıldığı anda hedef sayfaların kodu arka
 * planda geliyor, tıklamada bekleme kalmıyor.
 */
export default function SiteNav() {
  const pathname = usePathname();
  const [acik, setAcik] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const aktif = LINKS.find((link) => link.href === pathname);

  useEffect(() => {
    if (!acik) return;

    const disariTiklama = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setAcik(false);
    };
    const escBasimi = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAcik(false);
    };

    document.addEventListener("mousedown", disariTiklama);
    document.addEventListener("keydown", escBasimi);
    return () => {
      document.removeEventListener("mousedown", disariTiklama);
      document.removeEventListener("keydown", escBasimi);
    };
  }, [acik]);

  return (
    <nav
      aria-label="Sayfalar"
      className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur"
    >
      <div className="mx-auto flex max-w-[1100px] items-center gap-3 px-4 py-2.5 sm:px-6">
        <Link href="/" className="flex min-h-11 shrink-0 items-center gap-2 text-ink">
          <span
            aria-hidden="true"
            className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-sm font-bold text-white"
          >
            B
          </span>
          <span className="text-base font-semibold">Bitig</span>
        </Link>

        {/* Nerede olunduğu menüyü açmadan görünsün */}
        <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">
          {aktif && aktif.href !== "/" ? aktif.label : ""}
        </span>

        <div ref={panelRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setAcik((a) => !a)}
            aria-expanded={acik}
            aria-haspopup="menu"
            aria-label={acik ? "Menüyü kapat" : "Menüyü aç"}
            className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-surface text-ink transition-colors hover:border-brand hover:text-brand"
          >
            {acik ? <X size={20} /> : <Menu size={20} />}
          </button>

          {acik && (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
            >
              {LINKS.map(({ href, label, Icon }) => {
                const secili = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    role="menuitem"
                    prefetch
                    onClick={() => setAcik(false)}
                    aria-current={secili ? "page" : undefined}
                    className={`flex min-h-12 items-center gap-3 px-4 text-sm font-medium transition-colors ${
                      secili
                        ? "bg-brand-soft text-brand"
                        : "text-ink hover:bg-brand-soft hover:text-brand"
                    }`}
                  >
                    <Icon size={17} aria-hidden="true" />
                    {label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
