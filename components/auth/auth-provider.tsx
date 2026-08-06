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
  /** Supabase değişkenleri tanımsız; uygulama çalışamaz, kurulum gerekiyor */
  | "unconfigured"
  | "signed_out"
  | "signed_in";

export type AuthValue = {
  status: AuthStatus;
  client: SupabaseClient | null;
  session: Session | null;
  userId: string | null;
  userEmail: string | null;
  /** Google hesabından gelen ad; yoksa null */
  displayName: string | null;
  avatarUrl: string | null;

  signInWithGoogle: () => Promise<string | null>;
  signInWithPassword: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

/** Oturum bilgisi tek yerden okunur; her modül kendi oturumunu yönetmez. */
export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth yalnızca AuthProvider içinde kullanılabilir.");
  return value;
}

function readString(source: Record<string, unknown> | undefined, key: string): string | null {
  const value = source?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
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

  // Oturum yalnızca mount sonrası okunur: sunucuda localStorage yok, orada
  // karar verilirse istemciyle uyuşmayan HTML üretilir.
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

    void (async () => {
      const { data } = await client.auth.getSession();
      if (!mountedRef.current) return;

      if (!data.session) {
        setStatus("signed_out");
        return;
      }

      // getSession yalnızca depodan okur, jetonu sunucuda DOĞRULAMAZ. Hesap
      // silinmiş ya da oturum iptal edilmişse süresi dolana kadar duvarı geçer
      // ve kullanıcı boş bir uygulama görür. getUser sunucuya sorar.
      const { error } = await client.auth.getUser();
      if (!mountedRef.current) return;

      if (error) {
        await client.auth.signOut();
        if (!mountedRef.current) return;
        setSession(null);
        setStatus("signed_out");
        return;
      }

      setSession(data.session);
      setStatus("signed_in");
    })();

    const { data: sub } = client.auth.onAuthStateChange((_event, next) => {
      if (!mountedRef.current) return;
      setSession(next);
      setStatus(next ? "signed_in" : "signed_out");
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<string | null> => {
    const client = clientRef.current;
    if (!client) return "Supabase yapılandırılmamış.";

    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Aynı kökene dönülür; supabase-js adres çubuğundaki kodu kendisi
        // oturuma çevirir (detectSessionInUrl) ve parametreleri temizler.
        redirectTo: window.location.origin,
        queryParams: { prompt: "select_account" },
      },
    });

    return error ? error.message : null;
  }, []);

  const signInWithPassword = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      const client = clientRef.current;
      if (!client) return "Supabase yapılandırılmamış.";
      const { error } = await client.auth.signInWithPassword({ email, password });
      return error ? error.message : null;
    },
    [],
  );

  const signUp = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      const client = clientRef.current;
      if (!client) return "Supabase yapılandırılmamış.";
      const { error } = await client.auth.signUp({ email, password });
      return error ? error.message : null;
    },
    [],
  );

  const signOut = useCallback(async () => {
    await clientRef.current?.auth.signOut();
  }, []);

  const value = useMemo<AuthValue>(() => {
    const meta = session?.user?.user_metadata as Record<string, unknown> | undefined;
    return {
      status,
      client: clientRef.current,
      session,
      userId: session?.user?.id ?? null,
      userEmail: session?.user?.email ?? null,
      displayName: readString(meta, "full_name") ?? readString(meta, "name"),
      avatarUrl: readString(meta, "avatar_url") ?? readString(meta, "picture"),
      signInWithGoogle,
      signInWithPassword,
      signUp,
      signOut,
    };
  }, [status, session, signInWithGoogle, signInWithPassword, signUp, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
