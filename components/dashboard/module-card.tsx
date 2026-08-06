import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

export type ModuleCardProps = {
  href: string;
  title: string;
  description: string;
  Icon: LucideIcon;
  /** İkon ve ilerleme çizgisinin rengi (Tailwind sınıfları). */
  tint: { bg: string; text: string; bar: string };
  /** Özet satırının sol tarafı — ör. yapım adı. */
  primary: string;
  /** Özet satırının sağ tarafı — ör. "327. bölüm". */
  secondary: string | null;
  /**
   * 0-1 arası gerçek ilerleme. Güvenilir bir oran hesaplanamıyorsa null verilir
   * ve yüzde uydurmak yerine ince bir vurgu çizgisi gösterilir.
   */
  ratio: number | null;
  progressLabel?: string;
};

/** Kartın tamamı semantik bir Link — klavye ile açılabilir. */
export default function ModuleCard({
  href,
  title,
  description,
  Icon,
  tint,
  primary,
  secondary,
  ratio,
  progressLabel,
}: ModuleCardProps) {
  return (
    <Link
      href={href}
      className="group flex min-h-11 flex-col rounded-card border border-line bg-surface p-5 shadow-card transition-colors hover:border-line-strong"
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${tint.bg} ${tint.text}`}
        >
          <Icon size={22} strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink sm:text-lg">{title}</h2>
          <p className="mt-1 text-sm leading-snug text-ink-soft">{description}</p>
        </div>
      </div>

      <div className="mt-6 border-t border-line pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm font-medium text-ink">{primary}</span>
          {secondary && (
            <span className="shrink-0 text-sm text-ink-soft">{secondary}</span>
          )}
        </div>

        {ratio === null ? (
          // Güvenilir oran yok → kısa, ölçü iddiası taşımayan vurgu çizgisi
          <div aria-hidden="true" className="mt-2.5 h-1 w-16 rounded-full bg-line-strong" />
        ) : (
          <div
            role="progressbar"
            aria-label={progressLabel ?? title}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(ratio * 100)}
            className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-line"
          >
            <div
              className={`h-full rounded-full ${tint.bar}`}
              style={{ width: `${ratio * 100}%` }}
            />
          </div>
        )}
      </div>

      <span
        aria-hidden="true"
        className="mt-4 grid h-11 w-11 shrink-0 place-items-center self-end rounded-xl border border-line text-ink-soft transition-colors group-hover:border-brand group-hover:text-brand"
      >
        <ArrowRight size={18} />
      </span>
    </Link>
  );
}
