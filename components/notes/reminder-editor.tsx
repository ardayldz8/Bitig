"use client";

import { useState } from "react";
import { Bell, BellOff, Plus, Trash2 } from "lucide-react";
import { GUN_ADLARI, tekrarMetni, type Reminder } from "@/types/notes";

type Props = {
  reminders: Reminder[];
  onAdd: (time: string, days: number[]) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
};

/** Gün seçici: hiçbiri seçili değilse "her gün" demektir. */
function GunSecici({
  secili,
  onChange,
}: {
  secili: number[];
  onChange: (days: number[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {GUN_ADLARI.map((ad, index) => {
        const gun = index + 1;
        const aktif = secili.includes(gun);
        return (
          <button
            key={gun}
            type="button"
            aria-pressed={aktif}
            onClick={() =>
              onChange(
                aktif ? secili.filter((day) => day !== gun) : [...secili, gun].sort(),
              )
            }
            className={`min-h-11 min-w-11 rounded-xl border px-2 text-xs font-medium transition-colors ${
              aktif
                ? "border-brand bg-brand text-white"
                : "border-line bg-surface text-ink-soft hover:border-brand hover:text-brand"
            }`}
          >
            {ad}
          </button>
        );
      })}
    </div>
  );
}

export default function ReminderEditor({ reminders, onAdd, onToggle, onRemove }: Props) {
  const [saat, setSaat] = useState("09:00");
  const [gunler, setGunler] = useState<number[]>([]);

  const ekle = () => {
    if (!/^\d{2}:\d{2}$/.test(saat)) return;
    onAdd(saat, gunler);
    // Gün seçimi korunuyor: art arda birkaç saat eklerken (sabah/öğle/akşam)
    // aynı günleri tekrar tekrar seçtirmek gereksiz.
    setSaat("09:00");
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-ink">Hatırlatmalar</p>

      {reminders.length > 0 && (
        <ul className="space-y-2">
          {reminders.map((reminder) => (
            <li
              key={reminder.id}
              className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2"
            >
              <button
                type="button"
                onClick={() => onToggle(reminder.id)}
                aria-label={
                  reminder.enabled ? "Hatırlatmayı duraklat" : "Hatırlatmayı aç"
                }
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors ${
                  reminder.enabled
                    ? "bg-brand-soft text-brand"
                    : "bg-canvas text-ink-soft"
                }`}
              >
                {reminder.enabled ? <Bell size={16} /> : <BellOff size={16} />}
              </button>

              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-semibold tabular-nums ${
                    reminder.enabled ? "text-ink" : "text-ink-soft line-through"
                  }`}
                >
                  {reminder.time}
                </p>
                <p className="truncate text-xs text-ink-soft">
                  {tekrarMetni(reminder.days)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onRemove(reminder.id)}
                aria-label="Hatırlatmayı sil"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-danger-soft hover:text-danger"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 rounded-xl border border-dashed border-line-strong p-3">
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={saat}
            onChange={(event) => setSaat(event.target.value)}
            aria-label="Hatırlatma saati"
            className="min-h-11 rounded-xl border border-line bg-surface px-3 text-sm tabular-nums text-ink"
          />
          <button
            type="button"
            onClick={ekle}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-strong"
          >
            <Plus size={16} aria-hidden="true" />
            Saat ekle
          </button>
        </div>

        <GunSecici secili={gunler} onChange={setGunler} />
        <p className="text-xs text-ink-soft">
          {gunler.length === 0
            ? "Gün seçilmedi — her gün hatırlatılır."
            : tekrarMetni(gunler)}
        </p>
      </div>
    </div>
  );
}
