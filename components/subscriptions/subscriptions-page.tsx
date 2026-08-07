"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Pause, Play, Plus, Trash2, X } from "lucide-react";
import NotificationBanner from "@/components/notes/notification-banner";
import { useSubscriptions, type SubscriptionDraft } from "@/hooks/use-subscriptions";
import {
  daysUntil,
  formatAmount,
  monthlyTotal,
  nextDueDate,
  type Subscription,
} from "@/lib/subscriptions/calc";

const PARA = ["TRY", "USD", "EUR", "GBP"];
const alan = "min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-ink";

const BOS: SubscriptionDraft = {
  name: "",
  amount: 0,
  currency: "TRY",
  startedOn: new Date().toISOString().slice(0, 10),
  period: "monthly",
  notes: null,
};

export default function SubscriptionsPage({ vapidPublicKey }: { vapidPublicKey: string }) {
  const library = useSubscriptions();
  const [form, setForm] = useState<(SubscriptionDraft & { id?: string }) | null>(null);

  const bugun = useMemo(() => new Date(), []);

  /** Ödemesi en yakın olan üstte; pasifler en altta. */
  const sirali = useMemo(() => {
    return [...library.subscriptions]
      .map((item) => {
        const due = nextDueDate(item.startedOn, item.period, bugun);
        return { item, due, kalan: due ? daysUntil(due, bugun) : Number.MAX_SAFE_INTEGER };
      })
      .sort((a, b) => {
        if (a.item.active !== b.item.active) return a.item.active ? -1 : 1;
        return a.kalan - b.kalan;
      });
  }, [library.subscriptions, bugun]);

  const toplam = useMemo(() => monthlyTotal(library.subscriptions), [library.subscriptions]);

  const kaydet = () => {
    if (!form || !form.name.trim() || !(form.amount >= 0)) return;
    const draft: SubscriptionDraft = {
      name: form.name.trim(),
      amount: form.amount,
      currency: form.currency,
      startedOn: form.startedOn,
      period: form.period,
      notes: form.notes,
    };
    if (form.id) library.updateSubscription(form.id, draft);
    else library.addSubscription(draft);
    setForm(null);
  };

  return (
    <main className="mx-auto max-w-[1100px] px-4 pb-12 pt-6 sm:px-6 sm:pb-12">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold text-ink">Abonelikler</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Ne zaman ne kadar ödeyeceğini gör; ödemeden 7, 3 ve 1 gün önce bildirim al.
        </p>
      </header>

      <div className="mb-5">
        <NotificationBanner vapidPublicKey={vapidPublicKey} />
      </div>

      {toplam.size > 0 && (
        <div className="mb-5 rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm text-ink-soft">Aylık toplam</p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {[...toplam.entries()].map(([birim, tutar]) => (
              <p key={birim} className="text-2xl font-semibold text-ink">
                {formatAmount(Math.round(tutar * 100) / 100, birim)}
              </p>
            ))}
          </div>
          {/* Yıllıklar 12'ye bölünüyor; kur çevirisi YAPILMIYOR */}
          <p className="mt-1 text-xs text-ink-soft">
            Yıllık abonelikler aya bölündü. Para birimleri ayrı gösteriliyor —
            kur uydurulmuyor.
          </p>
        </div>
      )}

      {library.error && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {library.error}
        </p>
      )}

      <button
        type="button"
        onClick={() => setForm({ ...BOS })}
        className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-strong"
      >
        <Plus size={16} aria-hidden="true" />
        Abonelik ekle
      </button>

      {!library.hydrated && <p className="text-sm text-ink-soft">Yükleniyor…</p>}

      {library.hydrated && sirali.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line-strong px-4 py-10 text-center text-sm text-ink-soft">
          Henüz abonelik yok.
        </p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {sirali.map(({ item, due, kalan }) => (
          <Kart
            key={item.id}
            item={item}
            due={due}
            kalan={kalan}
            onEdit={() => setForm({ ...item })}
            onToggle={() => library.toggleActive(item.id)}
            onRemove={() => library.removeSubscription(item.id)}
          />
        ))}
      </ul>

      {form && (
        <Form
          form={form}
          onChange={setForm}
          onSave={kaydet}
          onClose={() => setForm(null)}
        />
      )}
    </main>
  );
}

function Kart({
  item,
  due,
  kalan,
  onEdit,
  onToggle,
  onRemove,
}: {
  item: Subscription;
  due: Date | null;
  kalan: number;
  onEdit: () => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  // Yaklaşan ödeme vurgulanır; eşikler bildirim eşikleriyle aynı
  const yakin = item.active && kalan <= 7;

  return (
    <li
      className={`rounded-2xl border bg-surface p-4 ${
        yakin ? "border-brand" : "border-line"
      } ${item.active ? "" : "opacity-60"}`}
    >
      <div className="flex items-start gap-2">
        <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-base font-semibold text-ink">{item.name}</span>
          <span className="block text-sm text-ink-soft">
            {formatAmount(item.amount, item.currency)} ·{" "}
            {item.period === "yearly" ? "yıllık" : "aylık"}
          </span>
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-label={item.active ? "Duraklat" : "Devam ettir"}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-soft transition-colors hover:text-brand"
        >
          {item.active ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Aboneliği sil"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-soft transition-colors hover:text-danger"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {item.active && due && (
        <p
          className={`mt-3 flex items-center gap-1.5 text-sm ${
            yakin ? "font-medium text-brand" : "text-ink-soft"
          }`}
        >
          <CalendarClock size={14} aria-hidden="true" />
          {kalan === 0
            ? "Bugün ödeme günü"
            : kalan === 1
              ? "Yarın ödenecek"
              : `${kalan} gün sonra · ${due.toISOString().slice(0, 10)}`}
        </p>
      )}

      {!item.active && <p className="mt-3 text-sm text-ink-soft">Duraklatıldı</p>}

      {item.notes && <p className="mt-2 text-xs text-ink-soft">{item.notes}</p>}
    </li>
  );
}

function Form({
  form,
  onChange,
  onSave,
  onClose,
}: {
  form: SubscriptionDraft & { id?: string };
  onChange: (next: SubscriptionDraft & { id?: string }) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={form.id ? "Aboneliği düzenle" : "Yeni abonelik"}
    >
      <div className="max-h-[92vh] w-full max-w-[480px] overflow-y-auto rounded-t-2xl bg-surface p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="min-w-0 flex-1 text-lg font-semibold text-ink">
            {form.id ? "Aboneliği düzenle" : "Yeni abonelik"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="grid h-11 w-11 place-items-center rounded-xl text-ink-soft hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="ab-ad">
              Ad
            </label>
            <input
              id="ab-ad"
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              placeholder="Netflix"
              className={alan}
            />
          </div>

          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="ab-tutar">
                Tutar
              </label>
              <input
                id="ab-tutar"
                type="number"
                inputMode="decimal"
                value={form.amount || ""}
                onChange={(e) => onChange({ ...form, amount: Number(e.target.value) })}
                className={alan}
              />
            </div>
            <div className="w-24 shrink-0">
              <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="ab-para">
                Birim
              </label>
              <select
                id="ab-para"
                value={form.currency}
                onChange={(e) => onChange({ ...form, currency: e.target.value })}
                className={alan}
              >
                {PARA.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="ab-tarih">
                İlk ödeme tarihi
              </label>
              <input
                id="ab-tarih"
                type="date"
                value={form.startedOn}
                onChange={(e) => onChange({ ...form, startedOn: e.target.value })}
                className={alan}
              />
            </div>
            <div className="w-32 shrink-0">
              <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="ab-periyot">
                Periyot
              </label>
              <select
                id="ab-periyot"
                value={form.period}
                onChange={(e) =>
                  onChange({ ...form, period: e.target.value === "yearly" ? "yearly" : "monthly" })
                }
                className={alan}
              >
                <option value="monthly">Aylık</option>
                <option value="yearly">Yıllık</option>
              </select>
            </div>
          </div>

          {/* Sonraki ödemeler bu tarihten türetiliyor, ayrıca girilmiyor */}
          <p className="text-xs text-ink-soft">
            Sonraki ödemeler ilk ödeme tarihinden hesaplanır.
          </p>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="ab-not">
              Not (opsiyonel)
            </label>
            <input
              id="ab-not"
              value={form.notes ?? ""}
              onChange={(e) => onChange({ ...form, notes: e.target.value || null })}
              placeholder="Aile planı, 4 kişi"
              className={alan}
            />
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onSave}
            className="min-h-11 flex-1 rounded-xl bg-brand px-4 text-sm font-medium text-white hover:bg-brand-strong"
          >
            Kaydet
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl border border-line px-4 text-sm font-medium text-ink hover:border-brand hover:text-brand"
          >
            Vazgeç
          </button>
        </div>
      </div>
    </div>
  );
}
