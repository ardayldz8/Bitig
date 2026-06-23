"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const [stage, setStage] = useState<"email" | "sent">("email");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendLink() {
    const e = email.trim();
    if (!e || busy) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: e,
      options: {
        shouldCreateUser: true,
        emailRedirectTo:
          typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setStage("sent");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <div className="mb-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon-192.png"
          alt="Bitig"
          className="mx-auto mb-4 h-16 w-16 rounded-3xl shadow-lg"
        />
        <h1 className="text-3xl font-bold tracking-tight">Bitig</h1>
        <p className="mt-1 text-[var(--muted)]">Yapay zeka destekli kişisel takip</p>
      </div>

      <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        {stage === "email" ? (
          <>
            <label className="mb-2 block text-sm font-medium text-[var(--muted)]">
              E-posta adresin
            </label>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendLink()}
              placeholder="ornek@eposta.com"
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none focus:border-indigo-400"
            />
            <button
              onClick={sendLink}
              disabled={busy || !email.trim()}
              className="mt-4 w-full rounded-2xl bg-indigo-500 py-3 font-medium text-white transition active:scale-[0.99] disabled:opacity-40"
            >
              {busy ? "Gönderiliyor…" : "Giriş bağlantısı gönder"}
            </button>
            <p className="mt-3 text-center text-xs text-[var(--muted)]">
              E-postana bir giriş bağlantısı göndereceğiz. Şifre yok.
            </p>
          </>
        ) : (
          <div className="text-center">
            <div className="mb-3 text-4xl">📧</div>
            <p className="font-medium">Bağlantıyı gönderdik</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              <span className="font-semibold text-[var(--foreground)]">{email}</span>{" "}
              adresine gelen e-postadaki <strong>"Sign in"</strong> bağlantısına tıkla —
              otomatik giriş yapacaksın.
            </p>
            <p className="mt-3 text-xs text-[var(--muted)]">
              Aynı tarayıcıda açtığından emin ol. E-posta birkaç dakika içinde gelmezse spam
              klasörüne bak.
            </p>
            <button
              onClick={() => {
                setStage("email");
                setError(null);
              }}
              className="mt-4 w-full text-center text-sm text-[var(--muted)] underline"
            >
              Başka e-posta / tekrar gönder
            </button>
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-500">
            {error}
          </p>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-[var(--muted)]">
        Giriş yapınca kayıtların tüm cihazlarında senkron olur.
      </p>
    </main>
  );
}
