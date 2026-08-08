"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Clapperboard, CreditCard, Flame } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  averageCalories,
  currentStreak,
  mediaSummary,
  trackedDays,
  weeklyReadingPace,
  yearlySpend,
  type GunlukKalori,
} from "@/lib/stats/compute";
import { formatAmount } from "@/lib/subscriptions/calc";

type Veri = {
  gunler: GunlukKalori[];
  mangalar: { name: string; currentChapter: number; createdAt: string | null }[];
  medya: { mediaType: string; status: string; rating: number | null }[];
  abonelikler: { amount: number; currency: string; period: string; active: boolean }[];
};

export default function StatsPage() {
  const { client, userId } = useAuth();
  const [veri, setVeri] = useState<Veri | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    if (!client || !userId) return;
    let iptal = false;

    void (async () => {
      try {
        /*
         * Son 90 gün: daha uzun aralık ortalamayı geçmişe boğuyor, daha kısa
         * aralık tek bir kötü hafta yüzünden yanıltıcı oluyor.
         */
        const doksanGunOnce = new Date(Date.now() - 90 * 86_400_000).toISOString();

        const [food, manga, media, subs] = await Promise.all([
          client
            .from("food_entries")
            .select("calories, consumed_at")
            .eq("user_id", userId)
            .gte("consumed_at", doksanGunOnce),
          client.from("mangas").select("name, current_chapter, created_at").eq("user_id", userId),
          client.from("media_entries").select("media_type, status, rating").eq("user_id", userId),
          client
            .from("subscriptions")
            .select("amount, currency, period, active")
            .eq("user_id", userId),
        ]);

        if (iptal) return;

        // Öğün kayıtlarını güne topla
        const gunToplam = new Map<string, number>();
        for (const satir of food.data ?? []) {
          const tarih = String(satir.consumed_at ?? "").slice(0, 10);
          if (!tarih) continue;
          gunToplam.set(tarih, (gunToplam.get(tarih) ?? 0) + Number(satir.calories ?? 0));
        }

        setVeri({
          gunler: [...gunToplam.entries()].map(([date, calories]) => ({ date, calories })),
          mangalar: (manga.data ?? []).map((row) => ({
            name: String(row.name),
            currentChapter: Number(row.current_chapter ?? 0),
            createdAt: typeof row.created_at === "string" ? row.created_at : null,
          })),
          medya: (media.data ?? []).map((row) => ({
            mediaType: String(row.media_type),
            status: String(row.status),
            rating: row.rating === null ? null : Number(row.rating),
          })),
          abonelikler: (subs.data ?? []).map((row) => ({
            amount: Number(row.amount ?? 0),
            currency: String(row.currency ?? "TRY"),
            period: String(row.period ?? "monthly"),
            active: row.active !== false,
          })),
        });
      } catch {
        if (!iptal) setHata("İstatistikler yüklenemedi.");
      }
    })();

    return () => {
      iptal = true;
    };
  }, [client, userId]);

  const bugun = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const simdi = useMemo(() => new Date(), []);

  if (hata) {
    return (
      <main className="mx-auto max-w-[1100px] px-4 pt-6 sm:px-6">
        <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{hata}</p>
      </main>
    );
  }

  if (!veri) {
    return (
      <main className="mx-auto max-w-[1100px] px-4 pt-6 sm:px-6">
        <p className="text-sm text-ink-soft">Yükleniyor…</p>
      </main>
    );
  }

  const ortalama = averageCalories(veri.gunler);
  const kayitliGun = trackedDays(veri.gunler);
  const seri = currentStreak(veri.gunler, bugun);
  const hiz = weeklyReadingPace(veri.mangalar, simdi);
  const toplamBolum = veri.mangalar.reduce((t, m) => t + m.currentChapter, 0);
  const medya = mediaSummary(veri.medya);
  const yillik = yearlySpend(veri.abonelikler);

  return (
    <main className="mx-auto max-w-[1100px] px-4 pb-12 pt-6 sm:px-6">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold text-ink">İstatistikler</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Biriktirdiğin verinin karşılığı. Kalori son 90 güne bakıyor.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Bolum baslik="Manga" Icon={BookOpen}>
          <Satir
            etiket="Okuma hızı"
            deger={hiz === null ? null : `${hiz.toFixed(1)} bölüm/hafta`}
            bosMesaj="En az bir haftalık kayıt gerekiyor"
          />
          <Satir etiket="Toplam okunan bölüm" deger={toplamBolum > 0 ? String(toplamBolum) : null} />
          <Satir etiket="Takip edilen manga" deger={String(veri.mangalar.length)} />
        </Bolum>

        <Bolum baslik="Kalori" Icon={Flame}>
          <Satir
            etiket="Günlük ortalama"
            deger={ortalama === null ? null : `${Math.round(ortalama)} kcal`}
            bosMesaj="Henüz kayıt yok"
          />
          {/* Ortalamanın kaç güne dayandığı, sayının kendisi kadar önemli */}
          <Satir
            etiket="Kayıt girilen gün"
            deger={kayitliGun > 0 ? `${kayitliGun} gün (90 günde)` : null}
          />
          <Satir etiket="Kesintisiz seri" deger={seri > 0 ? `${seri} gün` : null} />
        </Bolum>

        <Bolum baslik="Dizi / Film" Icon={Clapperboard}>
          <Satir etiket="Dizi / film" deger={`${medya.dizi} / ${medya.film}`} />
          <Satir
            etiket="Tamamlanan"
            deger={`${medya.tamamlanan} · izleniyor ${medya.izleniyor} · planlanan ${medya.planlanan}`}
          />
          <Satir
            etiket="Ortalama puan"
            deger={medya.ortalamaPuan === null ? null : `${medya.ortalamaPuan.toFixed(1)}/10`}
            bosMesaj="Henüz puan verilmemiş"
          />
        </Bolum>

        <Bolum baslik="Abonelikler" Icon={CreditCard}>
          {yillik.size === 0 ? (
            <p className="text-sm text-ink-soft">Kayıtlı abonelik yok.</p>
          ) : (
            [...yillik.entries()].map(([birim, tutar]) => (
              <Satir
                key={birim}
                etiket="Yıllık gider"
                deger={formatAmount(Math.round(tutar), birim)}
              />
            ))
          )}
          <Satir
            etiket="Aktif abonelik"
            deger={String(veri.abonelikler.filter((a) => a.active).length)}
          />
        </Bolum>
      </div>
    </main>
  );
}

function Bolum({
  baslik,
  Icon,
  children,
}: {
  baslik: string;
  Icon: typeof BookOpen;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-ink">
        <Icon size={17} className="text-brand" aria-hidden="true" />
        {baslik}
      </h2>
      <dl className="space-y-2">{children}</dl>
    </section>
  );
}

/** Veri yoksa sıfır DEĞİL, "henüz yok" gösterilir — ikisi farklı şeyler. */
function Satir({
  etiket,
  deger,
  bosMesaj = "—",
}: {
  etiket: string;
  deger: string | null;
  bosMesaj?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-ink-soft">{etiket}</dt>
      <dd
        className={`text-right text-sm font-medium ${deger === null ? "text-ink-soft" : "text-ink"}`}
      >
        {deger ?? bosMesaj}
      </dd>
    </div>
  );
}
