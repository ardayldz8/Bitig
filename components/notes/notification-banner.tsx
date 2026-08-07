"use client";

import { Bell, BellRing, Share, TriangleAlert } from "lucide-react";
import { usePush } from "@/hooks/use-push";

/**
 * Bildirim izni durumu ve açma/kapama.
 *
 * Her durum ayrı metin veriyor. "Bildirimler çalışmıyor" demek yetmiyor —
 * kullanıcının ne yapması gerektiği duruma göre tamamen farklı: iOS'ta ana
 * ekrana eklemek, reddedilmişse tarayıcı ayarlarından açmak, kapalıysa tek
 * tıkla izin vermek.
 */
export default function NotificationBanner({ vapidPublicKey }: { vapidPublicKey: string }) {
  const { durum, hata, mesgul, ac, kapat } = usePush(vapidPublicKey);

  if (durum === "yukleniyor") return null;

  if (durum === "acik") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-line bg-ok-soft px-4 py-3">
        <BellRing size={18} className="shrink-0 text-ok" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-sm text-ink">
          Bildirimler bu cihazda açık.
        </p>
        <button
          type="button"
          onClick={() => void kapat()}
          disabled={mesgul}
          className="min-h-11 shrink-0 rounded-xl px-3 text-sm font-medium text-ink-soft transition-colors hover:text-danger disabled:opacity-50"
        >
          Kapat
        </button>
      </div>
    );
  }

  if (durum === "ios_needs_install") {
    return (
      <div className="rounded-xl border border-line bg-brand-soft px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-medium text-ink">
          <Share size={16} className="shrink-0 text-brand" aria-hidden="true" />
          iPhone&apos;da bildirim için tek adım
        </p>
        <p className="mt-1.5 text-sm text-ink-soft">
          Safari&apos;de <strong className="text-ink">Paylaş</strong> →{" "}
          <strong className="text-ink">Ana Ekrana Ekle</strong> deyip uygulamayı
          oradan aç. iOS, bildirimlere yalnızca ana ekrana eklenmiş uygulamalarda
          izin veriyor.
        </p>
      </div>
    );
  }

  if (durum === "reddedildi") {
    return (
      <div className="rounded-xl border border-line bg-danger-soft px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-medium text-ink">
          <TriangleAlert size={16} className="shrink-0 text-danger" aria-hidden="true" />
          Bildirim izni reddedilmiş
        </p>
        <p className="mt-1.5 text-sm text-ink-soft">
          Tarayıcı ayarlarından bu site için bildirimlere izin verdikten sonra
          sayfayı yenile. Uygulama içinden tekrar sorulamıyor.
        </p>
      </div>
    );
  }

  if (durum === "desteklenmiyor") {
    return (
      <div className="rounded-xl border border-line bg-canvas px-4 py-3">
        <p className="text-sm text-ink-soft">
          Bu tarayıcı bildirim göndermeyi desteklemiyor. Notlar ve saatler yine
          de kaydedilir; bildirimi destekleyen bir cihazdan açabilirsin.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <div className="flex items-center gap-3">
        <Bell size={18} className="shrink-0 text-brand" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-sm text-ink">
          Hatırlatmaların ulaşması için bildirimleri aç.
        </p>
        <button
          type="button"
          onClick={() => void ac()}
          disabled={mesgul}
          className="min-h-11 shrink-0 rounded-xl bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-strong disabled:opacity-50"
        >
          {mesgul ? "Açılıyor…" : "Aç"}
        </button>
      </div>
      {hata && <p className="mt-2 text-sm text-danger">{hata}</p>}
    </div>
  );
}
