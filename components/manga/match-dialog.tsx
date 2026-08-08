"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";

type Candidate = {
  id: string;
  title: string;
  altTitles: string[];
  year: number | null;
  coverUrl: string | null;
  latestChapter: number | null;
  status: string | null;
};

/**
 * Mangayı MangaDex kaydına bağlama.
 *
 * Arama kutusu ASIL araç, AI önerisi yalnızca başlangıç noktası. Ölçüldü:
 * AI'nın Türkçe→İngilizce çevirisi güvenilmez ve deterministik değil — aynı
 * ad için farklı denemelerde farklı öneriler veriyor, bazen doğruyu buluyor
 * bazen bulmuyor. Kullanıcı ne okuduğunu biliyor; ona arama yaptırmak,
 * yanlış eşleşmeyi onaylatmaktan iyi.
 *
 * Bölüm sayısı her adayda gösteriliyor: aynı eserin birden çok MangaDex
 * kaydı olabiliyor ve doğrusunu ayırt etmenin en pratik yolu bu — 97.
 * bölümdeyseniz 3 bölümlük aday açıkça yanlış.
 */
export default function MatchDialog({
  mangaName,
  currentChapter,
  onPick,
  onClose,
}: {
  mangaName: string;
  currentChapter: number;
  onPick: (candidate: Candidate) => void;
  onClose: () => void;
}) {
  const [sorgu, setSorgu] = useState(mangaName);
  const [oneriler, setOneriler] = useState<string[]>([]);
  const [adaylar, setAdaylar] = useState<Candidate[] | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const ara = useCallback(async (metin: string) => {
    setYukleniyor(true);
    setHata(null);
    try {
      const client = getBrowserClient();
      const { data } = (await client?.auth.getSession()) ?? { data: { session: null } };
      const token = data.session?.access_token;
      if (!token) throw new Error("Oturum bulunamadı.");

      const response = await fetch("/api/manga/match", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: metin }),
      });
      const payload = (await response.json()) as {
        queries?: string[];
        candidates?: Candidate[];
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "Arama başarısız.");

      setOneriler(payload.queries ?? []);
      setAdaylar(payload.candidates ?? []);
    } catch (error) {
      setHata(error instanceof Error ? error.message : "Arama başarısız.");
    } finally {
      setYukleniyor(false);
    }
  }, []);

  // Açılışta kullanıcının adıyla bir kez ara
  useEffect(() => {
    void ara(mangaName);
  }, [ara, mangaName]);

  /** Okunan bölüme yakın ya da ilerisi — doğru aday büyük ihtimalle burada. */
  const makulMu = (aday: Candidate) =>
    aday.latestChapter !== null && aday.latestChapter >= currentChapter * 0.8;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${mangaName} için katalog eşleştirme`}
    >
      <div className="max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-t-2xl bg-surface p-5 sm:rounded-2xl">
        <div className="mb-3 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-ink">Katalogda eşleştir</h2>
            <p className="text-sm text-ink-soft">
              {mangaName} · {currentChapter}. bölümdesin
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-ink-soft hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mb-3 rounded-xl bg-canvas px-3 py-2 text-xs text-ink-soft">
          Katalog İngilizce/özgün adlarla arıyor. Türkçe ad genelde bulunmaz —
          bildiğin İngilizce adı yazmayı dene.
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void ara(sorgu);
          }}
          className="flex gap-2"
        >
          <input
            value={sorgu}
            onChange={(event) => setSorgu(event.target.value)}
            aria-label="Katalogda ara"
            className="min-h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-ink"
          />
          <button
            type="submit"
            disabled={yukleniyor}
            aria-label="Ara"
            className="grid min-h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand text-white hover:bg-brand-strong disabled:opacity-50"
          >
            <Search size={17} />
          </button>
        </form>

        {oneriler.length > 1 && (
          <div className="mt-2.5">
            <p className="mb-1 text-xs text-ink-soft">AI önerileri (tıkla, ara):</p>
            <div className="flex flex-wrap gap-1.5">
              {oneriler.slice(1).map((oneri) => (
                <button
                  key={oneri}
                  type="button"
                  onClick={() => {
                    setSorgu(oneri);
                    void ara(oneri);
                  }}
                  className="min-h-9 rounded-lg border border-line px-2.5 text-xs text-ink-soft transition-colors hover:border-brand hover:text-brand"
                >
                  {oneri}
                </button>
              ))}
            </div>
          </div>
        )}

        {yukleniyor && <p className="mt-4 text-sm text-ink-soft">Aranıyor…</p>}
        {hata && <p className="mt-4 text-sm text-danger">{hata}</p>}

        {!yukleniyor && adaylar !== null && adaylar.length === 0 && (
          <p className="mt-4 text-sm text-ink-soft">
            Sonuç yok. Farklı bir ad dene — eserin İngilizce ya da Korece adı
            işe yarayabilir.
          </p>
        )}

        {adaylar !== null && adaylar.length > 0 && (
          <ul className="mt-4 space-y-2">
            {adaylar.map((aday) => {
              const makul = makulMu(aday);
              return (
                <li key={aday.id}>
                  <button
                    type="button"
                    onClick={() => onPick(aday)}
                    className={`flex w-full gap-3 rounded-xl border p-2.5 text-left transition-colors hover:border-brand hover:bg-brand-soft ${
                      makul ? "border-brand/40" : "border-line"
                    }`}
                  >
                    {aday.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={aday.coverUrl}
                        alt=""
                        loading="lazy"
                        className="h-20 w-14 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="grid h-20 w-14 shrink-0 place-items-center rounded-lg bg-canvas text-ink-soft">
                        ?
                      </span>
                    )}

                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink">{aday.title}</span>
                      {aday.altTitles.length > 0 && (
                        <span className="mt-0.5 block truncate text-xs text-ink-soft">
                          {aday.altTitles.slice(0, 2).join(" · ")}
                        </span>
                      )}
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 text-xs">
                        <span className={makul ? "font-medium text-brand" : "text-ink-soft"}>
                          {aday.latestChapter !== null
                            ? `son bölüm ${aday.latestChapter}`
                            : "bölüm bilgisi yok"}
                        </span>
                        {aday.year && <span className="text-ink-soft">{aday.year}</span>}
                        {aday.status && <span className="text-ink-soft">{aday.status}</span>}
                        {makul && (
                          <span className="inline-flex items-center gap-0.5 text-brand">
                            <Check size={11} aria-hidden="true" />
                            bölüm sayısı uyuyor
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export type { Candidate };
