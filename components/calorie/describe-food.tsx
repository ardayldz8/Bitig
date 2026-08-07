"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { MessageSquareText, Send } from "lucide-react";

const ORNEKLER = [
  "iki dilim tost, kaşar ve tereyağı",
  "bir kase mercimek çorbası",
  "150 g ızgara tavuk, yanında pilav",
];

/**
 * Yediğini anlatarak ekleme.
 *
 * Fotoğraf çekmeyi unuttuğunda ya da yemek bittiğinde tek yol manuel giriş
 * kalıyordu. Model burada da besin değeri ÜRETMEZ — yalnızca ne ve ne kadar
 * yendiğini çıkarır, kalori yine kaynaklardan gelir.
 */
export default function DescribeFood({
  onSubmit,
  disabled,
}: {
  onSubmit: (text: string) => void;
  disabled: boolean;
}) {
  const fieldId = useId();
  const [text, setText] = useState("");

  const gonderilebilir = text.trim().length >= 3 && !disabled;

  function gonder() {
    if (!gonderilebilir) return;
    onSubmit(text.trim());
    setText("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter gönderir, Shift+Enter satır atlar — sohbet alanlarının alışılmış davranışı
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      gonder();
    }
  }

  return (
    <section
      aria-label="Yediğini anlat"
      className="rounded-card border border-line bg-surface p-5"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"
        >
          <MessageSquareText size={18} />
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-ink">Yediğini anlat</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Fotoğraf çekmeyi unuttuysan ne yediğini yaz — yiyecekleri ayırıp besin
            değerlerini veritabanından bulalım.
          </p>

          <label htmlFor={fieldId} className="sr-only">
            Ne yedin?
          </label>
          <textarea
            id={fieldId}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            rows={3}
            maxLength={2000}
            placeholder="Örn: az önce tost yedim, iki dilim beyaz ekmek, kaşar peyniri ve biraz tereyağı"
            className="mt-3 w-full resize-y rounded-xl border border-line bg-surface px-3.5 py-2.5 text-ink disabled:opacity-50"
          />

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={gonder}
              disabled={!gonderilebilir}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-strong disabled:opacity-50"
            >
              <Send size={15} aria-hidden="true" />
              {disabled ? "Çözümleniyor…" : "Ekle"}
            </button>
            <span className="text-xs text-ink-soft">Enter ile gönder</span>
          </div>

          {/* Ne yazılabileceğini göstermek, boş alana bakmaktan daha yol gösterici */}
          {text.length === 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {ORNEKLER.map((ornek) => (
                <li key={ornek}>
                  <button
                    type="button"
                    onClick={() => setText(ornek)}
                    disabled={disabled}
                    className="rounded-full border border-line px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
                  >
                    {ornek}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
