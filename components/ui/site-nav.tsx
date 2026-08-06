"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Clapperboard, FolderGit2, Flame, Home } from "lucide-react";

const LINKS = [
  { href: "/", label: "Ana Sayfa", Icon: Home },
  { href: "/manga", label: "Manga", Icon: BookOpen },
  { href: "/kalori", label: "Kalori", Icon: Flame },
  { href: "/dizi-film", label: "Dizi / Film", Icon: Clapperboard },
  { href: "/projeler", label: "Projeler", Icon: FolderGit2 },
] as const;

export default function SiteNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sayfalar"
      className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur"
    >
      <div className="mx-auto flex max-w-[1100px] items-center gap-3 px-4 py-2.5 sm:px-6">
        <Link
          href="/"
          className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg pr-1 text-ink"
        >
          <span
            aria-hidden="true"
            className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-sm font-bold text-white"
          >
            B
          </span>
          <span className="text-base font-semibold">Bitig</span>
        </Link>

        {/* Dar ekranda şerit kendi içinde kayar; sayfa yatay taşmaz */}
        <div className="-mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto px-1 sm:justify-end">
          {LINKS.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand text-white"
                    : "text-ink-soft hover:bg-brand-soft hover:text-brand"
                }`}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
