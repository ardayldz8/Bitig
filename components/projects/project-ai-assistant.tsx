"use client";

import { Sparkles } from "lucide-react";
import type { ProjectSummary, RoadmapDraft, ReleaseNotesDraft } from "@/lib/ai/schemas";

export type AiStage = "idle" | "summary" | "roadmap" | "release";

const SUMMARY_STEPS = [
  "Repository özeti hazırlanıyor",
  "Aktif işler analiz ediliyor",
  "Riskler belirleniyor",
  "Öneriler oluşturuluyor",
];

type AssistantProps = {
  available: boolean;
  busy: AiStage;
  error: string | null;
  summary: ProjectSummary | null;
  roadmap: RoadmapDraft | null;
  releaseNotes: ReleaseNotesDraft | null;
  onSummary: () => void;
  onRoadmap: () => void;
  onReleaseNotes: () => void;
};

export default function ProjectAiAssistant({
  available,
  busy,
  error,
  summary,
  roadmap,
  releaseNotes,
  onSummary,
  onRoadmap,
  onReleaseNotes,
}: AssistantProps) {
  return (
    <section className="space-y-4">
      <div className="rounded-card border border-line bg-surface p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Sparkles size={16} aria-hidden="true" className="text-brand" />
          AI Asistan
        </h3>
        <p className="mt-1.5 text-sm text-ink-soft">
          AI yalnızca <strong>taslak</strong> üretir. GitHub üzerinde hiçbir yazma işlemi
          yapamaz; issue açılması senin açık onayına bağlıdır.
        </p>

        {!available && (
          <p className="mt-3 rounded-xl bg-amber-100 px-3.5 py-3 text-sm text-amber-800">
            AI özellikleri yapılandırılmamış. Sunucuda <code>OPENROUTER_API_KEY</code>{" "}
            tanımlandığında bu bölüm etkinleşir.
          </p>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={onSummary}
            disabled={!available || busy !== "idle"}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
          >
            Proje özeti oluştur
          </button>
          <button
            type="button"
            onClick={onRoadmap}
            disabled={!available || busy !== "idle"}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line px-4 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
          >
            Roadmap taslağı
          </button>
          <button
            type="button"
            onClick={onReleaseNotes}
            disabled={!available || busy !== "idle"}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line px-4 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
          >
            Release note taslağı
          </button>
        </div>

        {/* Aşamalı yükleme — tek sonsuz spinner değil */}
        {busy !== "idle" && (
          <div aria-live="polite" className="mt-4 rounded-xl border border-line bg-canvas p-4">
            {busy === "summary" ? (
              <ol className="space-y-1.5 text-sm text-ink-soft">
                {SUMMARY_STEPS.map((step, index) => (
                  <li key={step}>
                    {index + 1}. {step}…
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-ink-soft">
                {busy === "roadmap" ? "Yol haritası" : "Release note"} taslağı
                hazırlanıyor…
              </p>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-3.5 py-3 text-sm text-danger">
            {error}
          </p>
        )}
      </div>

      {summary && (
        <div className="rounded-card border border-line bg-surface p-5">
          <h4 className="text-sm font-semibold text-ink">Proje özeti</h4>
          <p className="mt-2 text-sm text-ink-soft">{summary.overview}</p>
          <Section title="Teknolojiler" items={summary.technologies} />
          <Section title="Modüller" items={summary.modules} />
          <Section title="Aktif işler" items={summary.activeWork} />
          <Section title="Riskler" items={summary.risks} />
          <Section title="Öneriler" items={summary.recommendations} />
        </div>
      )}

      {roadmap && (
        <div className="rounded-card border border-line bg-surface p-5">
          <h4 className="text-sm font-semibold text-ink">Yol haritası taslağı</h4>
          <p className="mt-1 text-xs text-ink-soft">
            Taslak otomatik kaydedilmez — istediğini özellik olarak elle ekleyebilirsin.
          </p>
          <ol className="mt-3 space-y-4">
            {roadmap.phases.map((phase) => (
              <li key={phase.title}>
                <p className="text-sm font-medium text-ink">{phase.title}</p>
                <p className="text-xs text-ink-soft">{phase.goal}</p>
                <ul className="mt-1.5 space-y-1 text-sm text-ink-soft">
                  {phase.items.map((item) => (
                    <li key={item.title}>
                      • <span className="text-ink">{item.title}</span>{" "}
                      <span className="text-xs">({item.priority}) — {item.reason}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      )}

      {releaseNotes && (
        <div className="rounded-card border border-line bg-surface p-5">
          <h4 className="text-sm font-semibold text-ink">
            Release note taslağı
            {releaseNotes.version ? ` — ${releaseNotes.version}` : ""}
          </h4>
          <p className="mt-1 text-xs text-ink-soft">
            {releaseNotes.sourceCount} kaynak maddeden üretildi.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-canvas p-3.5 font-mono text-xs whitespace-pre-wrap text-ink">
            {releaseNotes.markdown}
          </pre>
        </div>
      )}
    </section>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-ink">{title}</p>
      <ul className="mt-1 space-y-1 text-xs text-ink-soft">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}
