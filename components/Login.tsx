"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

function tr(msg?: string): string {
  const m = (msg || "").toLowerCase();
  if (m.includes("invalid login")) return "E-posta veya şifre hatalı.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Bu e-posta zaten kayıtlı. 'Giriş yap'ı kullan; şifren yoksa aşağıdaki bağlantıyla gir.";
  if (m.includes("at least 6") || m.includes("password should")) return "Şifre en az 6 karakter olmalı.";
  if (m.includes("email not confirmed")) return "E-postan henüz onaylı değil; onay bağlantısına tıkla.";
  return msg || "Bir hata oldu.";
}

export default function Login() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit() {
    const e = email.trim();
    if (!e || busy) return;
    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalı.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: e, password });
        if (error) throw error;
        // başarılı: oturumu page.tsx'teki onAuthStateChange devralır
      } else {
        const { data, error } = await supabase.auth.signUp({ email: e, password });
        if (error) throw error;
        if (!data.session) {
          setNotice("Hesap oluşturuldu. E-postandaki onay bağlantısına tıkladıktan sonra 'Giriş yap' ile gir.");
          setMode("signin");
        }
      }
    } catch (err) {
      setError(tr(err instanceof Error ? err.message : undefined));
    } finally {
      setBusy(false);
    }
  }

  async function magicLink() {
    const e = email.trim();
    if (!e || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: e,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    setBusy(false);
    if (error) setError(tr(error.message));
    else setNotice("Giriş bağlantısı e-postana gönderildi. Girince Özet → Şifre belirle ile şifre koy; sonra hep şifreyle gir.");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <div className="mb-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="Bitig" className="mx-auto mb-4 h-16 w-16 rounded-3xl shadow-lg" />
        <h1 className="text-3xl font-bold tracking-tight">Bitig</h1>
        <p className="mt-1 text-[var(--muted)]">Yapay zeka destekli kişisel takip</p>
      </div>

      <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="mb-4 flex rounded-full bg-[var(--background)] p-1 ring-1 ring-[var(--border)]">
          {(
            [
              ["signin", "Giriş yap"],
              ["signup", "Kayıt ol"],
            ] as const
          ).map(([m, l]) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError(null);
                setNotice(null);
              }}
              className={`flex-1 rounded-full py-1.5 text-sm font-medium transition ${
                mode === m ? "bg-indigo-500 text-white" : "text-[var(--muted)]"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        <label className="mb-1 block text-sm font-medium text-[var(--muted)]">E-posta</label>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ornek@eposta.com"
          className="mb-3 w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none focus:border-indigo-400"
        />

        <label className="mb-1 block text-sm font-medium text-[var(--muted)]">Şifre</label>
        <input
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="En az 6 karakter"
          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none focus:border-indigo-400"
        />

        <button
          onClick={submit}
          disabled={busy || !email.trim() || !password}
          className="mt-4 w-full rounded-2xl bg-indigo-500 py-3 font-medium text-white transition active:scale-[0.99] disabled:opacity-40"
        >
          {busy ? "…" : mode === "signin" ? "Giriş yap" : "Kayıt ol"}
        </button>

        <button
          onClick={magicLink}
          disabled={busy || !email.trim()}
          className="mt-3 w-full text-center text-sm text-[var(--muted)] underline disabled:opacity-40"
        >
          Şifren yok mu? E-posta bağlantısıyla gir
        </button>

        {notice && <p className="mt-3 rounded-xl bg-indigo-500/10 px-3 py-2 text-sm">{notice}</p>}
        {error && (
          <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-[var(--muted)]">
        Bir kez giriş yap — uygulama açık kalır, kayıtların tüm cihazlarında senkron olur.
      </p>
    </main>
  );
}
