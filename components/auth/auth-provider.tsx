"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export type AuthStatus =
  /** Oturum durumu henüz okunmadı — hydration güvenli ilk hâl */
  | "loading"
  /** Supabase değişkenleri tanımsız; uygulama çalışamaz */
  | "unconfigured"
  | "signed_out"
  /** Şifre doğrulandı, TOTP kurulu değil — kurulum yapılmalı */
  | "needs_mfa_setup"
  /** TOTP kurulu ama bu oturumda kod girilmedi */
  | "needs_mfa_code"
  | "signed_in";

export type TotpEnrollment = {
  factorId: string;
  /** `<img src>` olarak kullanılabilir data URI */
  qrCode: string;
  /** QR okutulamazsa elle girilecek anahtar */
  secret: string;
};

/**
 * Supabase kare kodu ham SVG metni olarak dönüyor; `<img src>` bunu göstermez.
 *
 * `dangerouslySetInnerHTML` ile gömmek yerine data URI'ye çevriliyor: `<img>`
 * içindeki SVG betik çalıştıramaz, yani sunucudan gelen işaretleme sayfaya
 * enjekte edilmiş olmaz.
 */
function toImageSource(qrCode: string): string {
  if (qrCode.startsWith("data:")) return qrCode;
  return `data:image/svg+xml;utf8,${encodeURIComponent(qrCode)}`;
}

export type AuthValue = {
  status: AuthStatus;
  client: SupabaseClient | null;
  session: Session | null;
  userId: string | null;
  userEmail: string | null;

  signInWithPassword: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;

  /** Yeni TOTP faktörü oluşturur; henüz doğrulanmamıştır. */
  startTotpEnrollment: () => Promise<{ enrollment: TotpEnrollment | null; error: string | null }>;
  /** Kurulum sırasında girilen ilk kodu doğrular. */
  confirmTotpEnrollment: (factorId: string, code: string) => Promise<string | null>;
  /** Girişte 6 haneli kodu doğrular, oturumu aal2'ye çıkarır. */
  verifyTotpCode: (code: string) => Promise<string | null>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth yalnızca AuthProvider içinde kullanılabilir.");
  return value;
}

/** Supabase hata mesajlarını kullanıcının anlayacağı dile çevirir. */
function friendly(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid totp") || lower.includes("invalid code")) {
    return "Kod doğrulanamadı. Uygulamadaki güncel kodu gir.";
  }
  if (lower.includes("invalid login credentials")) {
    return "E-posta veya şifre hatalı.";
  }
  if (lower.includes("mfa") && lower.includes("disabled")) {
    return "Supabase projesinde TOTP doğrulaması kapalı.";
  }
  return message;
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const clientRef = useRef<SupabaseClient | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Oturumun hangi aşamada olduğunu Supabase'e sorarak belirler.
   *
   * `currentLevel`/`nextLevel` ikilisi üç durumu ayırır:
   *   aal1 → aal1  : TOTP kurulu değil
   *   aal1 → aal2  : kurulu ama bu oturumda kod girilmemiş
   *   aal2 → aal2  : kod girilmiş, tam yetkili
   */
  const resolveStatus = useCallback(async (client: SupabaseClient): Promise<AuthStatus> => {
    const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) return "needs_mfa_setup";

    if (data.currentLevel === "aal2") return "signed_in";
    return data.nextLevel === "aal2" ? "needs_mfa_code" : "needs_mfa_setup";
  }, []);

  const refresh = useCallback(
    async (client: SupabaseClient, next: Session | null) => {
      if (!next) {
        if (!mountedRef.current) return;
        setSession(null);
        setStatus("signed_out");
        return;
      }

      // getSession yalnızca depodan okur, jetonu sunucuda DOĞRULAMAZ. Hesap
      // silinmiş ya da oturum iptal edilmişse süresi dolana kadar duvarı geçer.
      const { error } = await client.auth.getUser();
      if (!mountedRef.current) return;

      if (error) {
        await client.auth.signOut();
        if (!mountedRef.current) return;
        setSession(null);
        setStatus("signed_out");
        return;
      }

      const resolved = await resolveStatus(client);
      if (!mountedRef.current) return;

      setSession(next);
      setStatus(resolved);
    },
    [resolveStatus],
  );

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setStatus("unconfigured");
      return;
    }

    const client = getBrowserClient();
    clientRef.current = client;
    if (!client) {
      setStatus("unconfigured");
      return;
    }

    void client.auth.getSession().then(({ data }) => refresh(client, data.session));

    const { data: sub } = client.auth.onAuthStateChange((_event, next) => {
      void refresh(client, next);
    });

    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  const signInWithPassword = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      const client = clientRef.current;
      if (!client) return "Supabase yapılandırılmamış.";
      const { error } = await client.auth.signInWithPassword({ email, password });
      return error ? friendly(error.message) : null;
    },
    [],
  );

  // Kayıt olma yolu kaldırıldı: uygulama tek kişilik ve hesap açıldı.
  // Sarmalayıcıyı bırakmak, ileride farkında olmadan yeniden bağlanmasına
  // davetiye çıkarırdı.

  const signOut = useCallback(async () => {
    await clientRef.current?.auth.signOut();
  }, []);

  const startTotpEnrollment = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return { enrollment: null, error: "Supabase yapılandırılmamış." };

    /** Yarım kalmış kayıtları siler — sayfa yenilenmiş ya da kurulum terk edilmiş olabilir. */
    async function clearUnverified() {
      const { data } = await client!.auth.mfa.listFactors();
      for (const factor of data?.all ?? []) {
        if (factor.status === "unverified") {
          await client!.auth.mfa.unenroll({ factorId: factor.id });
        }
      }
    }

    await clearUnverified();
    let { data, error } = await client.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Bitig",
    });

    // Supabase friendlyName'i benzersiz istiyor. Eşzamanlı iki istek (React
    // StrictMode efekti iki kez çalıştırır) ya da terk edilmiş bir kayıt
    // yüzünden çakışma olabiliyor; temizleyip bir kez daha denenir.
    if (error && /already exists/i.test(error.message)) {
      await clearUnverified();
      ({ data, error } = await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Bitig",
      }));
    }

    if (error || !data) {
      return { enrollment: null, error: friendly(error?.message ?? "Kurulum başlatılamadı.") };
    }

    return {
      enrollment: {
        factorId: data.id,
        qrCode: toImageSource(data.totp.qr_code),
        secret: data.totp.secret,
      },
      error: null,
    };
  }, []);

  const confirmTotpEnrollment = useCallback(
    async (factorId: string, code: string): Promise<string | null> => {
      const client = clientRef.current;
      if (!client) return "Supabase yapılandırılmamış.";

      const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code });
      if (error) return friendly(error.message);

      // Doğrulama oturumu aal2'ye çıkarır; durum yeniden okunur.
      const { data } = await client.auth.getSession();
      await refresh(client, data.session);
      return null;
    },
    [refresh],
  );

  const verifyTotpCode = useCallback(
    async (code: string): Promise<string | null> => {
      const client = clientRef.current;
      if (!client) return "Supabase yapılandırılmamış.";

      const { data: factors, error: listError } = await client.auth.mfa.listFactors();
      if (listError) return friendly(listError.message);

      const factor = (factors?.totp ?? []).find((item) => item.status === "verified");
      if (!factor) return "Doğrulanmış bir authenticator kaydı bulunamadı.";

      const { error } = await client.auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code,
      });
      if (error) return friendly(error.message);

      const { data } = await client.auth.getSession();
      await refresh(client, data.session);
      return null;
    },
    [refresh],
  );

  const value = useMemo<AuthValue>(
    () => ({
      status,
      client: clientRef.current,
      session,
      userId: session?.user?.id ?? null,
      userEmail: session?.user?.email ?? null,
      signInWithPassword,
      signOut,
      startTotpEnrollment,
      confirmTotpEnrollment,
      verifyTotpCode,
    }),
    [
      status,
      session,
      signInWithPassword,
      signOut,
      startTotpEnrollment,
      confirmTotpEnrollment,
      verifyTotpCode,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
