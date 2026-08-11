"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, Clock, Plus, X } from "lucide-react";
import NotificationBanner from "@/components/notes/notification-banner";
import VerseCard from "@/components/quran/verse-card";
import { useQuran } from "@/hooks/use-quran";
import { TURKISH_EDITIONS } from "@/lib/quran/editions";

/** En fazla dört meal — her biri gönderimde ek bir teyit isteği demek. */
const MEAL_SINIRI = 4;

export default function QuranPage({ vapidPublicKey }: { vapidPublicKey: string }) {
  const library = useQuran();
  const params = useSearchParams();
  const acilanId = params.get("ayet");

  const [yeniSaat, setYeniSaat] = useState("");
  const [sekme, setSekme] = useState<"kaydedilen" | "gecmis">("kaydedilen");

  const acilan = useMemo(
    () => (acilanId ? library.deliveries.find((d) => d.id === acilanId) ?? null : null),
    [acilanId, library.deliveries],
  );

  /*
   * Bildirimden gelindiyse o ayete kaydır. Bir kez: kullanıcı sonradan
   * sayfayı kaydırdığında geri zıplaması rahatsız edici olurdu.
   */
  const acilanRef = useRef<HTMLDivElement | null>(null);
  const kaydirildi = useRef(false);
  useEffect(() => {
    if (kaydirildi.current || !acilan || !acilanRef.current) return;
    kaydirildi.current = true;
    acilanRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [acilan]);

  const settings = library.settings;
  const acik = settings?.enabled ?? false;
  const secilenMealler = settings?.editions ?? [];

  const mealDegistir = (id: string) => {
    const varMi = secilenMealler.includes(id);
    if (varMi && secilenMealler.length === 1) return; // en az bir meal şart
    if (!varMi && secilenMealler.length >= MEAL_SINIRI) return;
    library.setEditions(
      varMi ? secilenMealler.filter((e) => e !== id) : [...secilenMealler, id],
    );
  };

  const saatEkle = () => {
    if (!/^\d{2}:\d{2}$/.test(yeniSaat)) return;
    library.addSlot(yeniSaat);
    setYeniSaat("");
  };

  const gecmis = useMemo(
    () => library.deliveries.filter((d) => !d.saved),
    [library.deliveries],
  );

  return (
    <main className="mx-auto max-w-[1100px] px-4 pb-12 pt-6 sm:px-6">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold text-ink">Kur&apos;an-ı Kerim</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Belirlediğin vakitlerde rastgele bir ayet gelir; beğendiklerini kaydedersin.
        </p>
      </header>

      <div className="mb-5">
        <NotificationBanner vapidPublicKey={vapidPublicKey} />
      </div>

      {library.error && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {library.error}
        </p>
      )}

      {/* --------------------------------------------------- Kaynak açıklaması */}
      <section className="mb-5 rounded-2xl border border-line bg-brand-soft p-4">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
          <BookOpen className="size-4" aria-hidden />
          Metin nereden geliyor
        </h2>
        <p className="text-sm leading-relaxed text-ink-soft">
          Ayet metni <strong className="text-ink">yapay zekâdan gelmiyor</strong>. Her ayet
          üç bağımsız kaynaktan çekiliyor (alquran.cloud, fawazahmed0, quran.com) ve Arapça
          metin harf harf karşılaştırılıyor. En az iki kaynak aynı metni vermezse{" "}
          <strong className="text-ink">o ayet hiç gönderilmiyor</strong>.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Mealler ise mütercimin yorumu — farklı olmaları hata değil. Onlarda doğrulanan
          şey metnin gerçekten o mütercime ait olduğu; sonuç her mealin yanında
          işaretleniyor.
        </p>
      </section>

      {/* ------------------------------------------------------------- Ayarlar */}
      {library.hydrated && !settings ? (
        <section className="mb-6 rounded-2xl border border-line bg-surface p-4">
          <h2 className="font-semibold text-ink">Ayet bildirimlerini aç</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Varsayılan vakitler: {["08:00", "12:00", "15:00", "18:00", "21:00"].join(" · ")}.
            Sonra istediğin gibi değiştirebilirsin.
          </p>
          <button
            type="button"
            onClick={library.enable}
            className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-brand px-4 font-medium text-white hover:bg-brand-strong"
          >
            Aç
          </button>
        </section>
      ) : settings ? (
        <section className="mb-6 space-y-4 rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-ink">Bildirimler</h2>
              <p className="text-sm text-ink-soft">
                {acik ? "Açık" : "Kapalı"} · {library.slots.length} vakit ·{" "}
                {settings.timezone}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={acik}
              aria-label="Ayet bildirimleri"
              onClick={() => library.setEnabled(!acik)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                acik ? "bg-brand" : "bg-line-strong"
              }`}
            >
              <span
                className={`absolute top-1 size-5 rounded-full bg-white transition-all ${
                  acik ? "left-6" : "left-1"
                }`}
              />
            </button>
          </div>

          {/* Vakitler */}
          <div className="border-t border-line pt-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-ink">
              <Clock className="size-4" aria-hidden />
              Vakitler
            </h3>
            <div className="flex flex-wrap gap-2">
              {library.slots.map((slot) => (
                <span
                  key={slot.id}
                  className="inline-flex items-center gap-1 rounded-xl border border-line py-1 pl-3 pr-1 text-sm text-ink"
                >
                  {slot.timeOfDay}
                  <button
                    type="button"
                    onClick={() => library.removeSlot(slot.id)}
                    aria-label={`${slot.timeOfDay} vaktini kaldır`}
                    className="inline-flex size-8 items-center justify-center rounded-lg text-ink-soft hover:text-danger"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </span>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                type="time"
                value={yeniSaat}
                onChange={(e) => setYeniSaat(e.target.value)}
                aria-label="Yeni vakit"
                className="min-h-11 rounded-xl border border-line bg-surface px-3 text-ink"
              />
              <button
                type="button"
                onClick={saatEkle}
                disabled={!yeniSaat}
                className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-line px-3 text-sm font-medium text-ink disabled:opacity-40"
              >
                <Plus className="size-4" aria-hidden />
                Ekle
              </button>
            </div>
          </div>

          {/* Mealler */}
          <div className="border-t border-line pt-4">
            <h3 className="mb-1 text-sm font-medium text-ink">Mealler</h3>
            <p className="mb-2 text-xs text-ink-soft">
              En fazla {MEAL_SINIRI} tane. Birden çok meali yan yana okumak, tek birine
              bakmaktan daha doğru bir izlenim verir.
            </p>
            <div className="flex flex-wrap gap-2">
              {TURKISH_EDITIONS.map((edition) => {
                const secili = secilenMealler.includes(edition.id);
                const dolu = !secili && secilenMealler.length >= MEAL_SINIRI;
                return (
                  <button
                    key={edition.id}
                    type="button"
                    onClick={() => mealDegistir(edition.id)}
                    aria-pressed={secili}
                    disabled={dolu}
                    className={`min-h-11 rounded-xl border px-3 text-sm ${
                      secili
                        ? "border-brand bg-brand-soft font-medium text-ink"
                        : "border-line text-ink-soft"
                    } disabled:opacity-40`}
                  >
                    {edition.name}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {/* ---------------------------------------------- Bildirimden gelen ayet */}
      {acilan && (
        <div ref={acilanRef} className="mb-6">
          <p className="mb-2 text-sm font-medium text-ink-soft">Sana gönderilen ayet</p>
          <VerseCard
            verse={acilan}
            vurgulu
            onToggleSave={() => library.toggleSaved(acilan.id)}
            onNoteChange={(note) => library.setNote(acilan.id, note)}
          />
        </div>
      )}

      {/* ------------------------------------------------------------- Listeler */}
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setSekme("kaydedilen")}
          aria-pressed={sekme === "kaydedilen"}
          className={`min-h-11 rounded-xl px-4 text-sm font-medium ${
            sekme === "kaydedilen" ? "bg-brand text-white" : "border border-line text-ink-soft"
          }`}
        >
          Kaydettiklerim ({library.saved.length})
        </button>
        <button
          type="button"
          onClick={() => setSekme("gecmis")}
          aria-pressed={sekme === "gecmis"}
          className={`min-h-11 rounded-xl px-4 text-sm font-medium ${
            sekme === "gecmis" ? "bg-brand text-white" : "border border-line text-ink-soft"
          }`}
        >
          Gelenler ({gecmis.length})
        </button>
      </div>

      {sekme === "kaydedilen" ? (
        library.saved.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-soft">
            Henüz kaydettiğin ayet yok. Gelen bir ayeti beğenirsen yer imi
            simgesine dokun.
          </p>
        ) : (
          <div className="space-y-4">
            {library.saved.map((verse) => (
              <VerseCard
                key={verse.id}
                verse={verse}
                onToggleSave={() => library.toggleSaved(verse.id)}
                onNoteChange={(note) => library.setNote(verse.id, note)}
              />
            ))}
          </div>
        )
      ) : gecmis.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-soft">
          Henüz ayet gönderilmedi. İlk bildirim, belirlediğin ilk vakitte gelecek.
        </p>
      ) : (
        <div className="space-y-4">
          {gecmis.map((verse) => (
            <VerseCard
              key={verse.id}
              verse={verse}
              onToggleSave={() => library.toggleSaved(verse.id)}
            />
          ))}
        </div>
      )}
    </main>
  );
}
