"use client";

import { ExternalLink, File, Folder, Star } from "lucide-react";
import type { RepositorySnapshot } from "@/types/github";

function formatSize(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ProjectFiles({
  snapshot,
}: {
  snapshot: RepositorySnapshot | null;
}) {
  if (!snapshot || snapshot.files.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-ink-soft">
        Dosya ağacı için projeyi bir GitHub repository&apos;sine bağlayıp senkronize et.
      </p>
    );
  }

  return (
    <section>
      <p className="mb-3 text-xs text-ink-soft">
        Sınırlı dosya listesi — {snapshot.files.length} kayıt. node_modules, .next, dist,
        build ve vendor klasörleri ile secret içerebilecek dosyalar hariç tutulur. Dosya
        içeriği yalnızca GitHub üzerinde açılır.
      </p>

      <ul className="space-y-1.5">
        {snapshot.files.map((file) => (
          <li
            key={file.path}
            className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3"
          >
            <span aria-hidden="true" className="shrink-0 text-ink-soft">
              {file.type === "dir" ? <Folder size={15} /> : <File size={15} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate font-mono text-xs text-ink">{file.path}</span>
                {file.important && (
                  <Star
                    size={12}
                    aria-label="AI analizi için önemli dosya"
                    className="shrink-0 text-brand"
                  />
                )}
              </span>
              <span className="text-[11px] text-ink-soft">
                {file.type === "dir" ? "Klasör" : "Dosya"} · {formatSize(file.size)}
              </span>
            </span>
            <a
              href={file.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${file.path} — GitHub'da aç`}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-line text-ink-soft transition-colors hover:border-brand hover:text-brand"
            >
              <ExternalLink size={15} aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
