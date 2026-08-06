"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  FolderOpen,
  GitPullRequest,
  Rocket,
  CircleDot,
} from "lucide-react";

export type StatsData = {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalFeatures: number;
  openPullRequests: number;
  openIssues: number;
  failingCi: number;
};

const CARDS: {
  key: keyof StatsData;
  label: string;
  hint: string;
  Icon: typeof FolderOpen;
  tint: string;
}[] = [
  { key: "totalProjects", label: "Toplam Proje", hint: "Tüm projelerin", Icon: FolderOpen, tint: "bg-brand-soft text-brand" },
  { key: "activeProjects", label: "Aktif Proje", hint: "Devam eden", Icon: Rocket, tint: "bg-emerald-100 text-emerald-700" },
  { key: "completedProjects", label: "Tamamlanan", hint: "Bitirilen projeler", Icon: CheckCircle2, tint: "bg-amber-100 text-amber-700" },
  { key: "totalFeatures", label: "Toplam Özellik", hint: "Tüm projelerde", Icon: Code2, tint: "bg-brand-soft text-brand" },
  { key: "openPullRequests", label: "Açık PR", hint: "GitHub", Icon: GitPullRequest, tint: "bg-sky-100 text-sky-700" },
  { key: "openIssues", label: "Açık Issue", hint: "GitHub", Icon: CircleDot, tint: "bg-violet-100 text-violet-700" },
  { key: "failingCi", label: "Başarısız CI", hint: "Dikkat gerekiyor", Icon: AlertTriangle, tint: "bg-rose-100 text-rose-700" },
];

export default function ProjectStats({ stats }: { stats: StatsData }) {
  return (
    <section aria-label="Proje istatistikleri">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {CARDS.map(({ key, label, hint, Icon, tint }) => (
          <li
            key={key}
            className="rounded-card border border-line bg-surface p-4 shadow-card"
          >
            <span
              aria-hidden="true"
              className={`mb-3 grid h-10 w-10 place-items-center rounded-xl ${tint}`}
            >
              <Icon size={18} />
            </span>
            <p className="text-xs text-ink-soft">{label}</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums text-ink">{stats[key]}</p>
            <p className="mt-0.5 text-[11px] text-ink-soft">{hint}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
