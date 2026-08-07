"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Copy, ShieldCheck } from "lucide-react";
import { useAuth, type TotpEnrollment } from "@/components/auth/auth-provider";
import CodeInput from "@/components/auth/code-input";

/**
 * İlk girişte TOTP kurulumu.
 *
 * Kurulum atlanamaz: hesap açıldıktan sonra tek yol burası. Faktör
 * doğrulanmadan RLS politikaları da veri erişimine izin vermiyor.
 */
export default function MfaSetup() {
  const auth = useAuth();
  const baseId = useId();

  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /**
   * İstek bir kez atılır, sonucu ref'te tutulur.
   *
   * StrictMode efekti iki kez çalıştırıyor. "Bir kez çalıştır" bayrağı
   * yetmiyor: ilk mount hemen iptal ediliyor, ikinci mount bayrağı görüp
   * erken dönüyor ve sonuç hiç uygulanmıyordu. Sözün kendisi saklanınca
   * ikinci mount aynı isteği bekliyor, yeni faktör oluşturulmuyor.
   */
  const requestRef = useRef<ReturnType<typeof auth.startTotpEnrollment> | null>(null);

  useEffect(() => {
    let active = true;
    requestRef.current ??= auth.startTotpEnrollment();

    void requestRef.current.then((result) => {
      if (!active) return;
      if (result.error) setError(result.error);
      else setEnrollment(result.enrollment);
    });

    return () => {
      active = false;
    };
  }, [auth]);

  async function submit() {
    if (!enrollment || busy) return;
    if (code.length !== 6) {
      setError("Kod 6 haneli olmalı.");
      return;
    }

    setBusy(true);
    setError(null);
    const message = await auth.confirmTotpEnrollment(enrollment.factorId, code);

    setBusy(false);
    if (message) {
      setError(message);
      setCode("");
    }
    // Başarılıysa provider kurtarma kodlarını üretir; AuthGate onları gösterir.
  }

  async function copySecret() {
    if (!enrollment) return;
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Pano erişimi reddedildi — anahtar zaten ekranda yazılı
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-card border border-line bg-surface p-6 shadow-card">
        <span
          aria-hidden="true"
          className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand"
        >
          <ShieldCheck size={20} />
        </span>

        <h1 className="mt-3 text-lg font-semibold text-ink">İki adımlı doğrulamayı kur</h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          Kare kodu Google Authenticator, Authy ya da benzeri bir uygulamayla okut.
          Bundan sonra her girişte şifrenin yanında 6 haneli kod istenecek.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger"
          >
            {error}
          </p>
        )}

        {!enrollment ? (
          <p className="mt-6 text-sm text-ink-soft" role="status">
            Kare kod hazırlanıyor…
          </p>
        ) : (
          <>
            <div className="mt-5 grid place-items-center rounded-xl border border-line bg-white p-4">
              {/* Supabase QR'ı SVG data URI olarak döner */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={enrollment.qrCode}
                alt="Authenticator uygulamasında okutulacak kare kod"
                width={200}
                height={200}
              />
            </div>

            <div className="mt-4">
              <p className="text-xs text-ink-soft">
                Kare kodu okutamıyorsan bu anahtarı elle gir:
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-canvas px-3 py-2 font-mono text-xs text-ink">
                  {enrollment.secret}
                </code>
                <button
                  type="button"
                  onClick={() => void copySecret()}
                  aria-label="Anahtarı kopyala"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line text-ink-soft transition-colors hover:text-brand"
                >
                  <Copy size={15} aria-hidden="true" />
                </button>
              </div>
              {copied && <p className="mt-1 text-xs text-ok">Kopyalandı.</p>}
            </div>

            <div className="mt-5 border-t border-line pt-5">
              <CodeInput
                id={`${baseId}-code`}
                label="Uygulamadaki kodu gir"
                value={code}
                onChange={setCode}
                onEnter={() => void submit()}
                disabled={busy}
              />

              <button
                type="button"
                onClick={() => void submit()}
                disabled={busy || code.length !== 6}
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-4 font-medium text-white transition-colors hover:bg-brand-strong disabled:opacity-50"
              >
                {busy ? "Doğrulanıyor…" : "Doğrula ve bitir"}
              </button>
            </div>
          </>
        )}

        <button
          type="button"
          onClick={() => void auth.signOut()}
          className="mt-4 min-h-11 w-full text-sm text-ink-soft underline"
        >
          Çıkış yap
        </button>
      </div>
    </main>
  );
}
