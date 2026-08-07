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
          onClick={() => void auth.signOut()}
          className="mt-4 min-h-11 w-full text-sm text-ink-soft underline"
        >
          Başka hesapla gir
        </button>
      </div>
    </main>
  );
}
