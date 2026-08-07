"use client";

import { useId, useState } from "react";
import { KeyRound } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import CodeInput from "@/components/auth/code-input";

/** Şifre doğrulandıktan sonraki ikinci adım: authenticator kodu. */
export default function MfaChallenge() {
  const auth = useAuth();
  const baseId = useId();

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Kurtarma kodu modu: authenticator'a erişilemiyorsa. */
  const [recovery, setRecovery] = useState(false);
  const [backupCode, setBackupCode] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    if (code.length !== 6) {
      setError("Kod 6 haneli olmalı.");
      return;
    }

    setBusy(true);
    setError(null);
    const message = await auth.verifyTotpCode(code);
    setBusy(false);

    if (message) {
      setError(message);
      setCode("");
    }
  }

  /**
   * Kurtarma kodu authenticator'ı SIFIRLAR, oturum açmaz.
   *
   * Supabase'in aal2 jetonunu yalnızca GoTrue üretebiliyor; kod doğrulanınca
   * faktör kaldırılıyor ve kullanıcı kurulum ekranına düşüyor. İki faktör
   * korunuyor: şifre + kurtarma kodu.
   */
  async function recover() {
    if (busy) return;
    if (backupCode.trim().length < 4) {
      setError("Kurtarma kodunu gir.");
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const { data } = await auth.client!.auth.getSession();
      const token = data.session?.access_token;

      const response = await fetch("/api/auth/recover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ code: backupCode.trim() }),
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          typeof payload === "object" && payload !== null
            ? (payload as { error?: unknown }).error
            : null;
        setError(typeof message === "string" ? message : "Kurtarma başarısız.");
        return;
      }

      const kalan =
        typeof payload === "object" && payload !== null
          ? (payload as { remainingCodes?: unknown }).remainingCodes
          : null;

      setNotice(
        `Authenticator kaydı kaldırıldı. Şimdi yeni cihazını bağlayacaksın.${
          typeof kalan === "number" ? ` Kalan kurtarma kodu: ${kalan}.` : ""
        }`,
      );

      // Oturumu tazele: faktör gitti, AuthGate kurulum ekranını göstermeli
      await auth.client!.auth.refreshSession();
    } catch {
      setError("Kurtarma sırasında bağlantı hatası.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-card border border-line bg-surface p-6 shadow-card">
        <span
          aria-hidden="true"
          className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand"
        >
          <KeyRound size={20} />
        </span>

        <h1 className="mt-3 text-lg font-semibold text-ink">Doğrulama kodu</h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          {auth.userEmail ? (
            <>
              <strong className="font-medium text-ink">{auth.userEmail}</strong> hesabı için
              authenticator uygulamandaki 6 haneli kodu gir.
            </>
          ) : (
            "Authenticator uygulamandaki 6 haneli kodu gir."
          )}
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger"
          >
            {error}
          </p>
        )}

        {notice && (
          <p
            role="status"
            className="mt-4 rounded-xl bg-brand-soft px-3.5 py-2.5 text-sm text-brand-strong"
          >
            {notice}
          </p>
        )}

        {recovery ? (
          <>
            <div className="mt-5">
              <label
                htmlFor={`${baseId}-backup`}
                className="mb-1.5 block text-sm font-medium text-ink"
              >
                Kurtarma kodu
              </label>
              <input
                id={`${baseId}-backup`}
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                value={backupCode}
                onChange={(event) => setBackupCode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void recover();
                  }
                }}
                disabled={busy}
                placeholder="XXXX-XXXX"
                className="min-h-12 w-full rounded-xl border border-line bg-surface px-3.5 text-center font-mono text-lg tracking-widest text-ink disabled:opacity-50"
              />
              <p className="mt-1.5 text-xs text-ink-soft">
                Kurulum sırasında kaydettiğin kodlardan biri. Her kod bir kez çalışır.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void recover()}
              disabled={busy || backupCode.trim().length < 4}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-4 font-medium text-white transition-colors hover:bg-brand-strong disabled:opacity-50"
            >
              {busy ? "Doğrulanıyor…" : "Kurtarma kodunu kullan"}
            </button>

            <button
              type="button"
              onClick={() => {
                setRecovery(false);
                setError(null);
              }}
              disabled={busy}
              className="mt-4 min-h-11 w-full text-sm text-ink-soft underline disabled:opacity-50"
            >
              Authenticator koduna dön
            </button>
          </>
        ) : (
          <>
            <div className="mt-5">
              <CodeInput
                id={`${baseId}-code`}
                label="Kod"
                value={code}
                onChange={setCode}
                onEnter={() => void submit()}
                disabled={busy}
              />
            </div>

            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy || code.length !== 6}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-4 font-medium text-white transition-colors hover:bg-brand-strong disabled:opacity-50"
            >
              {busy ? "Doğrulanıyor…" : "Giriş yap"}
            </button>

            <button
              type="button"
              onClick={() => {
                setRecovery(true);
                setError(null);
              }}
              className="mt-4 min-h-11 w-full text-sm text-ink-soft underline"
            >
              Authenticator&apos;ıma erişemiyorum
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => void auth.signOut()}
          className="mt-2 min-h-11 w-full text-sm text-ink-soft underline"
        >
          Başka hesapla gir
        </button>
      </div>
    </main>
  );
}
