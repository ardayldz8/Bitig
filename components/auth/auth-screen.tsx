"use client";

import { useId, useState, type FormEvent } from "react";
import { LogIn } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

/**
 * Giriş ekranı.
 *
 * Kayıt olma yolu bilinçli olarak YOK: uygulama tek kişilik ve hesap zaten
 * açıldı. Arayüzden kaldırmak tek başına yeterli değil — anon anahtarla
 * `/auth/v1/signup` ucuna doğrudan istek atılabilir — bu yüzden Supabase
 * panelinde "Allow new users to sign up" da kapatılmalıdır.
 */
export default function AuthScreen() {
  const auth = useAuth();
  const baseId = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    if (!email.trim()) {
      setError("E-posta adresini gir.");
      return;
    }
    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalı.");
      return;
    }

    setBusy(true);
    setError(null);

    const message = await auth.signInWithPassword(email.trim(), password);

    setBusy(false);
    if (message) setError(message);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-card border border-line bg-surface p-6 shadow-card">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid h-11 w-11 place-items-center rounded-xl bg-brand text-lg font-bold text-white"
          >
            B
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-ink">Bitig</h1>
            <p className="text-sm text-ink-soft">Manga, kalori, dizi/film ve daha fazlası</p>
          </div>
        </div>

        <p className="mt-5 text-sm text-ink-soft">
          Şifreni girdikten sonra authenticator uygulamandaki 6 haneli kod istenir.
        </p>

        <form onSubmit={submit} noValidate className="mt-5 space-y-3">
          <div>
            <label
              htmlFor={`${baseId}-email`}
              className="mb-1.5 block text-sm font-medium text-ink"
            >
              E-posta
            </label>
            <input
              id={`${baseId}-email`}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-ink"
            />
          </div>

          <div>
            <label
              htmlFor={`${baseId}-pass`}
              className="mb-1.5 block text-sm font-medium text-ink"
            >
              Şifre
            </label>
            <input
              id={`${baseId}-pass`}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-ink"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 font-medium text-white transition-colors hover:bg-brand-strong disabled:opacity-50"
          >
            <LogIn size={16} aria-hidden="true" />
            {busy ? "…" : "Giriş yap"}
          </button>
        </form>
      </div>
    </main>
  );
}
