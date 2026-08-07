"use client";

import { useId, useState, type FormEvent } from "react";
import { LogIn } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

/** Oturum yokken gösterilen tek ekran: e-posta + şifre. */
export default function AuthScreen() {
  const auth = useAuth();
  const baseId = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
          Giriş yaptıktan sonra authenticator uygulamandaki 6 haneli kod istenir.
          Kayıtlarına yalnızca sen erişebilirsin.
        </p>

        <form onSubmit={(event) => submit(event, "in")} noValidate className="mt-5 space-y-3">
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

          {error && (
            <p
              role="alert"
              className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger"
            >
              {error}
            </p>
          )}
          {notice && (
            <p className="rounded-xl bg-brand-soft px-3.5 py-2.5 text-sm text-brand-strong">
              {notice}
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
      </div>
    </main>
  );
}
