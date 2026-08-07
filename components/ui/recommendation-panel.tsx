"use client";

import { useCallback, useState } from "react";
import { ExternalLink, Plus, Sparkles, X } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";

type Catalog = {
  title: string;
  year: number | null;
  imageUrl: string | null;
  description: string | null;
  sourceUrl: string | null;
  source: string;
};

type Recommendation = {
  title: string;
  kind: "manga" | "series" | "movie";
  reason: string;
  basedOn: string;
  catalog: Catalog;
};

const KAYNAK_ADI: Record<string, string> = {
  mangadex: "MangaDex",
  tvmaze: "TVMaze",
  wikipedia: "Wikipedia",
};

/**
 * Kütüphaneye bakıp benzer eser öneren panel.
 *
 * Manga ve dizi/film sayfalarında ortak kullanılıyor; aralarındaki tek fark
 * `kind` ve eklenen kaydın nasıl oluşturulduğu.
 */
export default function RecommendationPanel({
  kind,
  onAdd,
}: {
  kind: "manga" | "media";
  /** Öneriyi kullanıcının listesine ekler. */
  onAdd: (item: Recommendation) => void;
}) {
  const [acik, setAcik] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [oneriler, setOneriler] = useState<Recommendation[] | null>(null);
  const [not, setNot] = useState("");
  const [elenen, setElenen] = useState(0);
  const [eklenenler, setEklenenler] = useState<Set<string>>(new Set());

  const getir = useCallback(async () => {
    setYukleniyor(true);
    setHata(null);
    try {
      const client = getBrowserClient();
      if (!client) throw new Error("Supabase yapılandırılmamış.");
      const { data } = await client.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Oturum bulunamadı.");

      const response = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ kind }),
      });

      const payload = (await response.json()) as {
        recommendations?: Recommendation[];
        note?: string;
        dropped?: number;
        error?: string;
      };

      if (!response.ok) throw new Error(payload.error ?? "Öneri alınamadı.");

      setOneriler(payload.recommendations ?? []);
      setNot(payload.note ?? "");
      setElenen(payload.dropped ?? 0);
    } catch (error) {
      setHata(error instanceof Error ? error.message : "Öneri alınamadı.");
    } finally {
      setYukleniyor(false);
    }
  }, [kind]);

  const ac = () => {
    setAcik(true);
    // Panel her açılışta yeniden istemesin; kullanıcı "Yenile" ile tazeler
    if (oneriler === null && !yukleniyor) void getir();
  };

  if (!acik) {
    return (
      <button
        type="button"
        onClick={ac}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand"
      >
        <Sparkles size={16} aria-hidden="true" />
        Bana öneri ver
      </button>
    );
  }

  return (
    <section
      aria-label="Öneriler"
      className="rounded-2xl border border-line bg-surface p-4 sm:p-5"
    >
      <div className="flex items-start gap-2">
        <h2 className="flex min-w-0 flex-1 items-center gap-2 text-base font-semibold text-ink">
          <Sparkles size={18} className="shrink-0 text-brand" aria-hidden="true" />
          Sana özel öneriler
        </h2>
        <button
          type="button"
          onClick={() => void getir()}
          disabled={yukleniyor}
          className="min-h-11 rounded-xl px-3 text-sm font-medium text-ink-soft transition-colors hover:text-brand disabled:opacity-50"
        >
          {yukleniyor ? "Aranıyor…" : "Yenile"}
        </button>
        <button
          type="button"
          onClick={() => setAcik(false)}
          aria-label="Önerileri kapat"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-ink-soft transition-colors hover:text-ink"
        >
          <X size={18} />
        </button>
      </div>

      {yukleniyor && (
        <p className="mt-3 text-sm text-ink-soft">
          Listendeki eserler inceleniyor, kataloglarda doğrulanıyor…
        </p>
      )}

      {hata && (
        <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-3.5 py-3 text-sm text-danger">
          {hata}
        </p>
      )}

      {!yukleniyor && !hata && not && (
        <p className="mt-3 rounded-xl bg-canvas px-3.5 py-3 text-sm text-ink-soft">{not}</p>
      )}

      {!yukleniyor && oneriler !== null && oneriler.length === 0 && !hata && (
        <p className="mt-3 text-sm text-ink-soft">Şu an gösterilecek öneri çıkmadı.</p>
      )}

      {oneriler !== null && oneriler.length > 0 && (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {oneriler.map((item) => {
            const eklendi = eklenenler.has(item.catalog.title);
            return (
              <li
                key={`${item.kind}-${item.catalog.title}`}
                className="flex gap-3 rounded-xl border border-line p-3"
              >
                {item.catalog.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.catalog.imageUrl}
                    alt=""
                    loading="lazy"
                    className="h-24 w-16 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="grid h-24 w-16 shrink-0 place-items-center rounded-lg bg-brand-soft text-lg font-bold text-brand"
                  >
                    {item.catalog.title.charAt(0)}
                  </span>
                )}

                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="text-sm font-semibold text-ink">
                    {item.catalog.title}
                    {item.catalog.year && (
                      <span className="ml-1 font-normal text-ink-soft">
                        ({item.catalog.year})
                      </span>
                    )}
                  </p>

                  <p className="mt-1 line-clamp-3 text-xs text-ink-soft">{item.reason}</p>

                  <p className="mt-1 text-[11px] text-ink-soft">
                    <span className="text-brand">{item.basedOn}</span> beğendiğin için
                  </p>

                  <div className="mt-auto flex items-center gap-1.5 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        onAdd(item);
                        setEklenenler((previous) => new Set(previous).add(item.catalog.title));
                      }}
                      disabled={eklendi}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-brand px-2.5 text-xs font-medium text-white transition-colors hover:bg-brand-strong disabled:bg-ok disabled:opacity-100"
                    >
                      {eklendi ? "Eklendi" : <><Plus size={13} aria-hidden="true" /> Listeme ekle</>}
                    </button>
                    {item.catalog.sourceUrl && (
                      <a
                        href={item.catalog.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs text-ink-soft transition-colors hover:text-brand"
                      >
                        <ExternalLink size={12} aria-hidden="true" />
                        {KAYNAK_ADI[item.catalog.source] ?? item.catalog.source}
                      </a>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/*
        Elenen öneriler açıkça söyleniyor. Sessizce düşürmek, AI 8 öneri verip
        ekranda 3 görünmesini kullanıcı açısından açıklanamaz kılardı.
      */}
      {elenen > 0 && !yukleniyor && (
        <p className="mt-3 text-xs text-ink-soft">
          {elenen} öneri kataloglarda doğrulanamadığı için gösterilmedi.
        </p>
      )}
    </section>
  );
}

export type { Recommendation };
