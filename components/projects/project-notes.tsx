"use client";

import { GitPullRequestArrow, Pencil, Pin, Plus, Sparkles, Trash2 } from "lucide-react";
import { renderMarkdown } from "@/lib/markdown";
import type { ProjectFeature, ProjectNote } from "@/types/project";

type NotesProps = {
  notes: ProjectNote[];
  features: ProjectFeature[];
  aiAvailable: boolean;
  busyNoteId: string | null;
  onAdd: () => void;
  onEdit: (note: ProjectNote) => void;
  onDelete: (note: ProjectNote) => void;
  onTogglePin: (note: ProjectNote) => void;
  onConvertToFeature: (note: ProjectNote) => void;
  onConvertToIssue: (note: ProjectNote) => void;
};

export default function ProjectNotes({
  notes,
  features,
  aiAvailable,
  busyNoteId,
  onAdd,
  onEdit,
  onDelete,
  onTogglePin,
  onConvertToFeature,
  onConvertToIssue,
}: NotesProps) {
  const sorted = [...notes].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt),
  );

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">
          Notlar <span className="text-ink-soft">{notes.length}</span>
        </h3>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-strong"
        >
          <Plus size={16} aria-hidden="true" />
          Not ekle
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-card border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-ink-soft">
          Henüz not yok.
        </p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((note) => {
            const related = features.find((f) => f.id === note.relatedFeatureId);
            const busy = busyNoteId === note.id;

            return (
              <li key={note.id} className="rounded-card border border-line bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 font-medium text-ink">
                      {note.pinned && (
                        <Pin size={13} aria-label="Sabitlenmiş" className="text-brand" />
                      )}
                      {note.title}
                    </p>

                    {/* Markdown önce kaçışlanır, sonra sınırlı biçimlendirme uygulanır */}
                    <div
                      className="prose-note mt-1.5 text-sm text-ink-soft"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(note.content) }}
                    />

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                      {note.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-canvas px-2 py-0.5">
                          #{tag}
                        </span>
                      ))}
                      {related && <span>Bağlı özellik: {related.title}</span>}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => onConvertToFeature(note)}
                      disabled={!aiAvailable || busy}
                      aria-label={`${note.title} notunu AI ile özellik taslağına dönüştür`}
                      title={
                        aiAvailable
                          ? "AI ile özellik taslağı"
                          : "AI yapılandırılmamış (OPENROUTER_API_KEY)"
                      }
                      className="grid h-11 w-11 place-items-center rounded-lg border border-line text-ink-soft transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Sparkles size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onConvertToIssue(note)}
                      disabled={!aiAvailable || busy}
                      aria-label={`${note.title} notundan GitHub issue taslağı oluştur`}
                      className="grid h-11 w-11 place-items-center rounded-lg border border-line text-ink-soft transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <GitPullRequestArrow size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onTogglePin(note)}
                      aria-label={`${note.title} notunu ${note.pinned ? "sabitlemeyi kaldır" : "sabitle"}`}
                      className="grid h-11 w-11 place-items-center rounded-lg border border-line text-ink-soft transition-colors hover:border-brand hover:text-brand"
                    >
                      <Pin size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(note)}
                      aria-label={`${note.title} notunu düzenle`}
                      className="grid h-11 w-11 place-items-center rounded-lg border border-line text-ink-soft transition-colors hover:border-brand hover:text-brand"
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(note)}
                      aria-label={`${note.title} notunu sil`}
                      className="grid h-11 w-11 place-items-center rounded-lg border border-line text-ink-soft transition-colors hover:border-danger hover:text-danger"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
