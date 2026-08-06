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

/**
 * İki ayrı yerleşim:
 *
 * Geniş ekran — üstte yapışkan şerit, etiketler tam.
 * Dar ekran   — altta sekme çubuğu. Beş bağlantı aynı anda görünür (eskiden
 *               yatay kaydırma gerekiyordu, "Projeler" ekran dışında kalıyordu)
 *               ve başparmak menzilinde durur. Üst şerit gizlenir; sayfa
 *               başlıkları zaten nerede olunduğunu söylüyor, iki çubuk dar
 *               ekranda boşuna dikey alan yiyordu.
 */
export default function SiteNav() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href;

  return (
    <>
      <nav
        aria-label="Sayfalar"
        className="sticky top-0 z-30 hidden border-b border-line bg-canvas/90 backdrop-blur sm:block"
      >
        <div className="mx-auto flex max-w-[1100px] items-center gap-3 px-6 py-2.5">
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

          {/* Sığmazsa alt satıra sarar — yatay kaydırma bandı yerine. */}
          <div className="flex min-w-0 flex-1 flex-wrap justify-end gap-1">
            {LINKS.map(({ href, label, Icon }) => {
              const active = isActive(href);
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

      {/* Dar ekran: alt sekme çubuğu. Ana ekrana eklenmiş PWA'da çene/gesture
          alanına denk gelmemesi için safe-area kadar iç boşluk bırakılır. */}
      <nav
        aria-label="Sayfalar"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 backdrop-blur sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid grid-cols-5">
          {LINKS.map(({ href, label, Icon }) => {
            const active = isActive(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex min-h-[3.5rem] flex-col items-center justify-center gap-1 px-0.5 pt-1.5 pb-1 transition-colors ${
                    active ? "text-brand" : "text-ink-soft"
                  }`}
                >
                  {/* Aktif sekme yalnızca renkle ayrılmasın */}
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-3 top-0 h-0.5 rounded-b-full ${
                      active ? "bg-brand" : "bg-transparent"
                    }`}
                  />
                  <Icon size={20} aria-hidden="true" />
                  <span className="w-full truncate text-center text-[10px] font-medium leading-none">
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
