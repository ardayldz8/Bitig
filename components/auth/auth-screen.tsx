"use client";

import { useId, useState, type FormEvent } from "react";
import { LogIn, UserPlus } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

/** Oturum yokken gösterilen tek ekran: e-posta + şifre. */
type Mode = "in" | "up";

export default function AuthScreen() {
  const auth = useAuth();
  const baseId = useId();

  /**
   * Giriş ve kayıt aynı formu paylaşır ama mod AÇIKÇA seçilir.
   * Önceden "Kayıt ol" bir bağlantı gibi görünüp aynı formu sessizce kayıt
   * olarak gönderiyordu; alanlar boşken hiçbir şey olmuyor sanılıyordu.
   */
  const [mode, setMode] = useState<Mode>("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

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
    setNotice(null);

    const message =
      mode === "in"
        ? await auth.signInWithPassword(email.trim(), password)
        : await auth.signUp(email.trim(), password);

    setBusy(false);
    if (message) {
      setError(message);
      return;
    }

    if (mode === "up") {
      // Kayıt başarılı ama oturum açılmadıysa e-posta onayı bekleniyordur.
      setNotice(
        "Hesap oluşturuldu. Gelen kutuna onay bağlantısı gönderildi; tıkladıktan sonra buradan giriş yap.",
      );
      setMode("in");
      setPassword("");
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

        {/* Hangi işlemi yaptığın her zaman görünür olsun */}
        <div
          role="tablist"
          aria-label="Giriş ya da kayıt"
          className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-canvas p-1"
        >
          {(
            [
              ["in", "Giriş yap"],
              ["up", "Kayıt ol"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => switchMode(value)}
              disabled={busy}
              className={`min-h-10 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                mode === value
                  ? "bg-surface text-ink shadow-card"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="mt-4 text-sm text-ink-soft">
          {mode === "in"
            ? "Şifreni girdikten sonra authenticator uygulamandaki 6 haneli kod istenir."
            : "Hesap açtıktan sonra ilk girişte authenticator kurulumu yapacaksın."}
        </p>

        <form onSubmit={submit} noValidate className="mt-4 space-y-3">
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
              // Şifre yöneticisi kayıtta yeni şifre önersin, girişte kayıtlıyı doldursun
              autoComplete={mode === "in" ? "current-password" : "new-password"}
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
            {mode === "in" ? (
              <LogIn size={16} aria-hidden="true" />
            ) : (
              <UserPlus size={16} aria-hidden="true" />
            )}
            {busy ? "…" : mode === "in" ? "Giriş yap" : "Hesap oluştur"}
          </button>
        </form>
      </div>
    </main>
  );
}
