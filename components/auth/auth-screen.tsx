"use client";

import { useId, useState, type FormEvent } from "react";
import { LogIn } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

/** Google'ın marka yönergesi renkli "G" işaretini olduğu gibi istiyor. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

/**
 * Oturum yokken gösterilen tek ekran.
 *
 * Google birincil yol; e-posta/şifre yedek olarak duruyor. Google sağlayıcısı
 * Supabase'de açılmamışsa kullanıcı tamamen kilitli kalmasın diye ikisi de var.
 */
export default function AuthScreen() {
  const auth = useAuth();
  const baseId = useId();

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function withGoogle() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const message = await auth.signInWithGoogle();
    // Başarılıysa tarayıcı Google'a gider; buraya dönülmez.
    if (message) {
      setBusy(false);
      setError(
        message.toLowerCase().includes("provider")
          ? "Google girişi Supabase'de henüz açılmamış. Aşağıdan e-posta ile girebilirsin."
          : message,
      );
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>, mode: "in" | "up") {
    event.preventDefault();
    if (busy) return;

    if (!email.trim() || password.length < 6) {
      setError("E-posta gir ve şifreyi en az 6 karakter yap.");
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);

    const message =
      mode === "in"
        ? await auth.signInWithPassword(email.trim(), password)
        : await auth.signUp(email.trim(), password);

    setBusy(false);
    if (message) {
      setError(message);
    } else if (mode === "up") {
      setNotice(
        "Kayıt oluşturuldu. E-posta onayı gerekiyorsa gelen kutunu kontrol et, sonra giriş yap.",
      );
    }
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
            <p className="text-sm text-ink-soft">Manga, kalori, dizi/film ve projeler</p>
          </div>
        </div>

        <p className="mt-5 text-sm text-ink-soft">
          Verilerin hesabına bağlı olarak bulutta saklanır ve cihazların arasında senkron
          olur. Kayıtlarına yalnızca sen erişebilirsin.
        </p>

        <button
          type="button"
          onClick={() => void withGoogle()}
          disabled={busy}
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface px-4 font-medium text-ink transition-colors hover:border-brand hover:bg-brand-soft disabled:opacity-50"
        >
          <GoogleMark />
          Google ile devam et
        </button>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger"
          >
            {error}
          </p>
        )}
        {notice && (
          <p className="mt-4 rounded-xl bg-brand-soft px-3.5 py-2.5 text-sm text-brand-strong">
            {notice}
          </p>
        )}

        {!showPasswordForm ? (
          <button
            type="button"
            onClick={() => setShowPasswordForm(true)}
            className="mt-4 min-h-11 w-full text-sm text-ink-soft underline"
          >
            E-posta ve şifre ile gir
          </button>
        ) : (
          <form
            onSubmit={(event) => submit(event, "in")}
            noValidate
            className="mt-5 space-y-3 border-t border-line pt-5"
          >
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
                placeholder="En az 6 karakter"
                className="min-h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-ink"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 font-medium text-white transition-colors hover:bg-brand-strong disabled:opacity-50"
            >
              <LogIn size={16} aria-hidden="true" />
              {busy ? "…" : "Giriş yap"}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={(event) =>
                submit(event as unknown as FormEvent<HTMLFormElement>, "up")
              }
              className="min-h-11 w-full text-sm text-ink-soft underline disabled:opacity-50"
            >
              Hesabın yok mu? Kayıt ol
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
