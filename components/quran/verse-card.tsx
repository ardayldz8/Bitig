"use client";

import { AlertTriangle, BookmarkCheck, Bookmark, HelpCircle, ShieldCheck } from "lucide-react";
import type { Delivery } from "@/types/quran";

/**
 * Teyit rozetleri.
 *
 * Üç durum ayrı gösteriliyor. "Kaynağa ulaşılamadı" ile "kaynak farklı metin
 * verdi" aynı simgeyle gösterilseydi, gerçek bir uyuşmazlık geçici bir ağ
 * hatasıymış gibi görünürdü — asıl önemli olan bilgi kaybolurdu.
 */
function TeyitRozeti({ durum }: { durum: Delivery["translations"][number]["confirmation"] }) {
  if (durum === "confirmed") {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-ink-soft"
        title="İkinci bağımsız kaynak aynı metni verdi"
      >
        <ShieldCheck className="size-3.5 text-ok" aria-hidden />
        teyitli
      </span>
    );
  }

  if (durum === "differs") {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-danger"
        title="İkinci kaynak FARKLI bir metin verdi — dikkatle oku"
      >
        <AlertTriangle className="size-3.5" aria-hidden />
        kaynaklar ayrışıyor
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-ink-soft"
      title="İkinci kaynağa ulaşılamadı — metin yanlış demek değil, teyit edilemedi demek"
    >
      <HelpCircle className="size-3.5" aria-hidden />
      teyit edilemedi
    </span>
  );
}

export default function VerseCard({
  verse,
  onToggleSave,
  onNoteChange,
  vurgulu = false,
}: {
  verse: Delivery;
  onToggleSave: () => void;
  onNoteChange?: (note: string) => void;
  vurgulu?: boolean;
}) {
  return (
    <article
      className={`rounded-2xl border bg-surface p-4 ${
        vurgulu ? "border-brand shadow-sm" : "border-line"
      }`}
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-ink">
            {verse.surahNameLatin || verse.surahName}{" "}
            <span className="text-ink-soft">
              {verse.surah}:{verse.ayah}
            </span>
          </h3>
          <p className="mt-0.5 text-xs text-ink-soft">
            Arapça metin {verse.arabicSources.length} bağımsız kaynakta aynı
            {verse.arabicSources.length > 0 && ` (${verse.arabicSources.join(", ")})`}
          </p>
        </div>

        <button
          type="button"
          onClick={onToggleSave}
          aria-pressed={verse.saved}
          aria-label={verse.saved ? "Kayıttan çıkar" : "Kaydet"}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-line text-ink-soft hover:text-ink"
        >
          {verse.saved ? (
            <BookmarkCheck className="size-5 text-brand" aria-hidden />
          ) : (
            <Bookmark className="size-5" aria-hidden />
          )}
        </button>
      </header>

      {/*
        Arapça metin sağdan sola ve büyük punto. `lang` ve `dir` yalnızca
        görsel değil: ekran okuyucular doğru sesletim için bunlara bakıyor.
      */}
      <p
        lang="ar"
        dir="rtl"
        className="mb-4 text-right text-2xl leading-[2.1] text-ink"
        style={{ fontFamily: "'Scheherazade New', 'Amiri', 'Traditional Arabic', serif" }}
      >
        {verse.arabic}
      </p>

      <div className="space-y-3">
        {verse.translations.map((t) => (
          <div key={t.edition || t.name} className="border-t border-line pt-3">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-ink-soft">{t.name}</span>
              <TeyitRozeti durum={t.confirmation} />
            </div>
            <p className="text-sm leading-relaxed text-ink">{t.text}</p>
          </div>
        ))}
      </div>

      {verse.saved && onNoteChange && (
        <div className="mt-4 border-t border-line pt-3">
          <label
            htmlFor={`not-${verse.id}`}
            className="mb-1 block text-xs font-medium text-ink-soft"
          >
            Kendi notun
          </label>
          <textarea
            id={`not-${verse.id}`}
            value={verse.note}
            onChange={(e) => onNoteChange(e.target.value)}
            rows={2}
            placeholder="Bu ayet sana ne düşündürdü?"
            className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink"
          />
        </div>
      )}
    </article>
  );
}
