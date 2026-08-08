import Link from "next/link";
import { Camera, Clapperboard, Code2, Plus, Zap, type LucideIcon } from "lucide-react";

const ACTIONS: {
  href: string;
  label: string;
  Icon: LucideIcon;
  tint: string;
}[] = [
  { href: "/manga?action=add", label: "Manga ekle", Icon: Plus, tint: "text-brand" },
  {
    href: "/dizi-film?action=add",
    label: "Dizi / Film ekle",
    Icon: Clapperboard,
    tint: "text-amber-600",
  },
  { href: "/repolar", label: "Repolar", Icon: Code2, tint: "text-sky-600" },
  {
    href: "/kalori?action=scan",
    label: "Yemek tara",
    Icon: Camera,
    tint: "text-emerald-600",
  },
];

/** Sunucu bileşeni — sadece bağlantılar, istemci mantığı yok. */
export default function QuickActions() {
  return (
    <section
      aria-label="Hızlı ekle"
      className="rounded-card border border-line bg-surface p-5 shadow-card"
    >
      <h2 className="flex items-center gap-2.5 text-base font-semibold text-ink">
        <span
          aria-hidden="true"
          className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft text-brand"
        >
          <Zap size={17} strokeWidth={1.75} />
        </span>
        Hızlı ekle
      </h2>

      <ul className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ACTIONS.map(({ href, label, Icon, tint }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex min-h-11 flex-col items-center justify-center gap-2 rounded-xl border border-line px-3 py-4 text-center transition-colors hover:border-brand hover:bg-brand-soft/40"
            >
              <Icon size={20} strokeWidth={1.75} aria-hidden="true" className={tint} />
              <span className="text-sm font-medium text-ink">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
