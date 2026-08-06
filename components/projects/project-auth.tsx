"use client";

import { useId, useState, type FormEvent } from "react";
import { Database, LogIn } from "lucide-react";

type AuthProps = {
  onSignIn: (email: string, password: string) => Promise<string | null>;
  onSignUp: (email: string, password: string) => Promise<string | null>;
};

/** Supabase yapılandırılmış ama oturum yokken gösterilen giriş paneli. */
export default function ProjectAuth({ onSignIn, onSignUp }: AuthProps) {
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
        ? await onSignIn(email.trim(), password)
        : await onSignUp(email.trim(), password);

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
    <div className="mx-auto mt-6 max-w-md rounded-card border border-line bg-surface p-6 shadow-card">
      <span
        aria-hidden="true"
        className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand"
      >
        <Database size={20} />
      </span>

      <h2 className="mt-3 text-lg font-semibold text-ink">Projelerine giriş yap</h2>
      <p className="mt-1.5 text-sm text-ink-soft">
        Supabase bağlı. Giriş yaptığında projelerin bulutta saklanır ve cihazlar arasında
        senkron olur. Verilerine yalnızca sen erişebilirsin (RLS).
      </p>

      <form onSubmit={(event) => submit(event, "in")} noValidate className="mt-5 space-y-3">
        <div>
          <label htmlFor={`${baseId}-email`} className="mb-1.5 block text-sm font-medium text-ink">
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
          <label htmlFor={`${baseId}-pass`} className="mb-1.5 block text-sm font-medium text-ink">
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
          <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
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
            submit(
              event as unknown as FormEvent<HTMLFormElement>,
              "up",
            )
          }
          className="min-h-11 w-full text-sm text-ink-soft underline disabled:opacity-50"
        >
          Hesabın yok mu? Kayıt ol
        </button>
      </form>
    </div>
  );
}
