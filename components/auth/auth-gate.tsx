"use client";

import { AlertTriangle } from "lucide-react";
import AuthScreen from "@/components/auth/auth-screen";
import { useAuth } from "@/components/auth/auth-provider";
import LocalImportBanner from "@/components/auth/local-import-banner";
import SiteNav from "@/components/ui/site-nav";

/**
 * Giriş duvarı. Oturum yoksa sayfa içeriği HİÇ render edilmez — gizlenmez,
 * render edilmez; navbar da çizilmez, çünkü giriş yapmamış birine gidilecek
 * yer göstermenin anlamı yok.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <p className="text-sm text-ink-soft" role="status">
          Yükleniyor…
        </p>
      </div>
    );
  }

  if (status === "unconfigured") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4">
        <div className="rounded-card border border-line bg-surface p-6 shadow-card">
          <span
            aria-hidden="true"
            className="grid h-11 w-11 place-items-center rounded-xl bg-amber-100 text-amber-700"
          >
            <AlertTriangle size={20} />
          </span>
          <h1 className="mt-3 text-lg font-semibold text-ink">Kurulum tamamlanmamış</h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            Uygulama verileri hesabına bağlı tuttuğu için Supabase bağlantısı olmadan
            çalışamaz.{" "}
            <code className="rounded bg-canvas px-1 font-mono text-xs">
              NEXT_PUBLIC_SUPABASE_URL
            </code>{" "}
            ve{" "}
            <code className="rounded bg-canvas px-1 font-mono text-xs">
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </code>{" "}
            tanımlanmalı.
          </p>
        </div>
      </main>
    );
  }

  if (status === "signed_out") {
    return <AuthScreen />;
  }

  return (
    <>
      <SiteNav />
      <LocalImportBanner />
      {children}
    </>
  );
}
