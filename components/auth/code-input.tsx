"use client";

import type { ChangeEvent, KeyboardEvent } from "react";

/**
 * 6 haneli TOTP kodu alanı.
 *
 * `type="number"` bilerek kullanılmıyor: baştaki sıfırları yiyor ve mobilde
 * artır/azalt okları çıkarıyor. `inputMode="numeric"` telefonda rakam
 * klavyesini açar, `autoComplete="one-time-code"` iOS'ta kodu panodan önerir.
 */
export default function CodeInput({
  id,
  value,
  onChange,
  onEnter,
  disabled,
  label,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  onEnter?: () => void;
  disabled?: boolean;
  label: string;
}) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    // Yapıştırılan kodda boşluk/tire olabiliyor; yalnızca rakamlar alınır
    onChange(event.target.value.replace(/\D/g, "").slice(0, 6));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && onEnter) {
      event.preventDefault();
      onEnter();
    }
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="000000"
        aria-describedby={`${id}-hint`}
        className="min-h-12 w-full rounded-xl border border-line bg-surface px-3.5 text-center font-mono text-2xl tracking-[0.4em] text-ink disabled:opacity-50"
      />
      <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-soft">
        Kod 30 saniyede bir yenilenir.
      </p>
    </div>
  );
}
