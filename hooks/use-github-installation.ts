"use client";

import { useCallback, useEffect, useState } from "react";
import type { StorageMode } from "@/hooks/use-projects";

export type GithubInstallation = {
  installationId: number;
  accountLogin: string | null;
};

type State = {
  installation: GithubInstallation | null;
  loading: boolean;
  error: string | null;
};

const IDLE: State = { installation: null, loading: false, error: null };

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const data: unknown = await response.json();
    return typeof data === "object" && data !== null
      ? (data as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function parseInstallation(payload: Record<string, unknown>): GithubInstallation | null {
  const raw = payload.installation;
  if (typeof raw !== "object" || raw === null) return null;

  const record = raw as Record<string, unknown>;
  const id = Number(record.installationId);
  if (!Number.isInteger(id) || id <= 0) return null;

  return {
    installationId: id,
    accountLogin:
      typeof record.accountLogin === "string" && record.accountLogin.length > 0
        ? record.accountLogin
        : null,
  };
}

/**
 * GitHub bağlantısını kalıcı olarak yönetir.
 *
 * URL'deki `installation_id` yalnızca kurulumdan dönüşte bir kez görülür.
 * Kalıcı kaynak sunucudaki kayıttır; parametre varsa önce kayıt oluşturulur
 * (claim), ardından parametre URL'den temizlenir. Böylece sayfa yenilendiğinde
 * bağlantı kaybolmaz.
 *
 * Yerel modda (Supabase yok) kalıcılık mümkün değildir — o durumda parametre
 * olduğu gibi kullanılır ve yenilemede kaybolur.
 */
export function useGithubInstallation({
  enabled,
  mode,
  accessToken,
  pendingInstallationId,
  onConsumed,
}: {
  enabled: boolean;
  mode: StorageMode;
  accessToken: string | null;
  pendingInstallationId: number | null;
  onConsumed: () => void;
}): State & { disconnect: () => Promise<void> } {
  const [state, setState] = useState<State>(IDLE);

  useEffect(() => {
    if (!enabled || mode === "loading") return;

    // Supabase yok: sunucuda saklanacak yer de yok, parametreyle yetin
    if (mode === "local") {
      setState({
        installation:
          pendingInstallationId !== null
            ? { installationId: pendingInstallationId, accountLogin: null }
            : null,
        loading: false,
        error: null,
      });
      return;
    }

    if (!accessToken) {
      setState(IDLE);
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const auth = { Authorization: `Bearer ${accessToken}` };

    async function run() {
      // Kurulumdan yeni dönüldüyse kaydı oluştur
      if (pendingInstallationId !== null) {
        const response = await fetch("/api/github/installation", {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify({ installationId: pendingInstallationId }),
        });
        const payload = await readJson(response);

        if (cancelled) return;

        if (!response.ok) {
          setState({
            installation: null,
            loading: false,
            error:
              typeof payload.error === "string"
                ? payload.error
                : "GitHub bağlantısı kaydedilemedi.",
          });
          onConsumed();
          return;
        }

        setState({ installation: parseInstallation(payload), loading: false, error: null });
        onConsumed();
        return;
      }

      const response = await fetch("/api/github/installation", { headers: auth });
      const payload = await readJson(response);
      if (cancelled) return;

      if (!response.ok) {
        setState({
          installation: null,
          loading: false,
          error:
            typeof payload.error === "string"
              ? payload.error
              : "GitHub bağlantısı okunamadı.",
        });
        return;
      }

      setState({ installation: parseInstallation(payload), loading: false, error: null });
    }

    run().catch(() => {
      if (!cancelled) {
        setState({ installation: null, loading: false, error: "Ağ hatası." });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, mode, accessToken, pendingInstallationId, onConsumed]);

  const disconnect = useCallback(async () => {
    if (!accessToken) {
      setState(IDLE);
      return;
    }

    const response = await fetch("/api/github/installation", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      setState((prev) => ({ ...prev, error: "Bağlantı kaldırılamadı." }));
      return;
    }

    setState(IDLE);
  }, [accessToken]);

  return { ...state, disconnect };
}
