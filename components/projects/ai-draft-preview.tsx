"use client";

import { useId, useState } from "react";
import { ShieldCheck } from "lucide-react";
import Modal from "@/components/ui/modal";
import type { FeatureDraft, GitHubIssueDraft } from "@/lib/ai/schemas";

export type DraftPreview =
  | { kind: "feature"; draft: FeatureDraft }
  | { kind: "issue"; draft: GitHubIssueDraft; canCreate: boolean };

type PreviewProps = {
  preview: DraftPreview;
  creating: boolean;
  onSaveFeature: (draft: FeatureDraft) => void;
  onCreateIssueDraft: (draft: FeatureDraft) => void;
  onConfirmIssue: (draft: GitHubIssueDraft) => void;
  onClose: () => void;
};

const fieldClass = "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-ink";

/**
 * AI taslak ön izlemesi.
 * Hiçbir taslak otomatik kaydedilmez; GitHub'a yazma yalnızca kullanıcı
 * "GitHub issue oluştur" düğmesine bastığında gerçekleşir.
 */
export default function AiDraftPreview({
  preview,
  creating,
  onSaveFeature,
  onCreateIssueDraft,
  onConfirmIssue,
  onClose,
}: PreviewProps) {
  const baseId = useId();
  const [issueTitle, setIssueTitle] = useState(
    preview.kind === "issue" ? preview.draft.title : "",
  );
  const [issueBody, setIssueBody] = useState(
    preview.kind === "issue" ? preview.draft.body : "",
  );

  if (preview.kind === "feature") {
    const draft = preview.draft;
    return (
      <Modal title="AI özellik taslağı" titleId={`${baseId}-t`} onClose={onClose}>
        <p className="flex items-start gap-2 rounded-xl bg-brand-soft px-3.5 py-3 text-sm text-brand-strong">
          <ShieldCheck size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          Bu bir taslaktır. Sen kaydetmeden hiçbir şey projene eklenmez ve GitHub&apos;a
          yazılmaz.
        </p>

        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-xs font-medium text-ink-soft">Başlık</dt>
            <dd className="font-medium text-ink">{draft.title}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-ink-soft">Açıklama</dt>
            <dd className="whitespace-pre-wrap text-ink-soft">{draft.description}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-ink-soft">Öncelik</dt>
            <dd className="text-ink">{draft.priority}</dd>
          </div>
          {draft.acceptanceCriteria.length > 0 && (
            <div>
              <dt className="text-xs font-medium text-ink-soft">Kabul kriterleri</dt>
              <dd>
                <ul className="mt-1 space-y-1 text-ink-soft">
                  {draft.acceptanceCriteria.map((item) => (
                    <li key={item}>✓ {item}</li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
          {draft.relatedFiles.length > 0 && (
            <div>
              <dt className="text-xs font-medium text-ink-soft">İlgili dosyalar</dt>
              <dd className="font-mono text-xs text-ink-soft">
                {draft.relatedFiles.join(", ")}
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line px-4 font-medium text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={() => onCreateIssueDraft(draft)}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line px-4 font-medium text-ink transition-colors hover:border-brand hover:text-brand"
          >
            GitHub issue taslağı oluştur
          </button>
          <button
            type="button"
            onClick={() => onSaveFeature(draft)}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 font-medium text-white transition-colors hover:bg-brand-strong"
          >
            Özellik olarak kaydet
          </button>
        </div>
      </Modal>
    );
  }

  const issue = preview.draft;
  return (
    <Modal title="GitHub issue taslağı" titleId={`${baseId}-t`} onClose={onClose}>
      <p className="flex items-start gap-2 rounded-xl bg-amber-100 px-3.5 py-3 text-sm text-amber-800">
        <ShieldCheck size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
        Bu taslak GitHub&apos;a <strong>henüz yazılmadı</strong>. Düzenleyip onaylarsan
        repository&apos;de gerçek bir issue açılır.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label htmlFor={`${baseId}-title`} className="mb-1.5 block text-sm font-medium text-ink">
            Issue başlığı
          </label>
          <input
            id={`${baseId}-title`}
            type="text"
            value={issueTitle}
            onChange={(event) => setIssueTitle(event.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor={`${baseId}-body`} className="mb-1.5 block text-sm font-medium text-ink">
            Issue içeriği (Markdown)
          </label>
          <textarea
            id={`${baseId}-body`}
            rows={10}
            value={issueBody}
            onChange={(event) => setIssueBody(event.target.value)}
            className={`${fieldClass} font-mono text-xs`}
          />
        </div>
        {issue.labels.length > 0 && (
          <p className="text-xs text-ink-soft">Etiketler: {issue.labels.join(", ")}</p>
        )}
      </div>

      {!preview.canCreate && (
        <p className="mt-3 text-xs text-ink-soft">
          GitHub bağlı olmadığı için issue oluşturulamaz. Taslağı kopyalayıp elle
          açabilirsin.
        </p>
      )}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line px-4 font-medium text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand"
        >
          İptal
        </button>
        <button
          type="button"
          disabled={!preview.canCreate || creating || !issueTitle.trim()}
          onClick={() =>
            onConfirmIssue({ ...issue, title: issueTitle.trim(), body: issueBody })
          }
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 font-medium text-white transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creating ? "Oluşturuluyor…" : "GitHub issue oluştur"}
        </button>
      </div>
    </Modal>
  );
}
