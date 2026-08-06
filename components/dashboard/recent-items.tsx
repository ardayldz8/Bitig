"use client";

import Link from "next/link";
import {
  BookOpen,
  ChevronRight,
  Clapperboard,
  Clock,
  Code2,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { formatUpdatedAt } from "@/lib/dashboard/dashboard-utils";
import type {
  DashboardModule,
  DashboardRecentItem,
} from "@/lib/dashboard/dashboard-types";

const MODULE_ICON: Record<DashboardModule, LucideIcon> = {
  manga: BookOpen,
  calorie: UtensilsCrossed,
  media: Clapperboard,
  projects: Code2,
};

const MODULE_TINT: Record<DashboardModule, string> = {
  manga: "bg-brand-soft text-brand",
  calorie: "bg-emerald-50 text-emerald-600",
  media: "bg-amber-50 text-amber-600",
  projects: "bg-sky-50 text-sky-600",
};

export default function RecentItems({ items }: { items: DashboardRecentItem[] }) {
  return (
    <section
      aria-label="Son kaldıkların"
      className="rounded-card border border-line bg-surface p-5 shadow-card"
    >
      <h2 className="flex items-center gap-2.5 text-base font-semibold text-ink">
        <span
          aria-hidden="true"
          className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft text-brand"
        >
          <Clock size={17} strokeWidth={1.75} />
        </span>
        Son kaldıkların
      </h2>

      {items.length === 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          Henüz güncel bir kayıt bulunmuyor.
          <br />
          Aşağıdaki hızlı işlemlerden ilk kaydını ekleyebilirsin.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {items.map((item) => {
            const Icon = MODULE_ICON[item.module];
            const time = formatUpdatedAt(item.updatedAt);

            return (
              <li key={item.id}>
                {/* Her satır kendi modülüne gider — tek ortak hedef kullanılmaz */}
                <Link
                  href={item.href}
                  className="flex min-h-11 items-center gap-3 py-3 transition-colors hover:text-brand"
                >
                  <span
                    aria-hidden="true"
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${MODULE_TINT[item.module]}`}
                  >
                    <Icon size={16} strokeWidth={1.75} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      {item.title}
                    </span>
                    <span className="block truncate text-xs text-ink-soft">
                      {item.subtitle}
                    </span>
                  </span>

                  {/* Gerçek zaman yoksa saat gösterilmez */}
                  {time && (
                    <span className="shrink-0 text-xs text-ink-soft">{time}</span>
                  )}

                  <ChevronRight
                    size={16}
                    aria-hidden="true"
                    className="shrink-0 text-ink-soft"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
