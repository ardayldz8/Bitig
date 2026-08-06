import { createAppJwt } from "@/lib/github/app-auth";

type CachedToken = { token: string; expiresAt: number };

/**
 * Installation token'ları süreç içinde kısa süreli önbelleklenir.
 * Token ASLA istemciye gönderilmez; yalnızca sunucu tarafı isteklerde kullanılır.
 */
const cache = new Map<number, CachedToken>();

export class GitHubAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubAuthError";
  }
}

export async function getInstallationToken(installationId: number): Promise<string> {
  const cached = cache.get(installationId);
  // Süresi dolmadan 60 sn önce yenile
  if (cached && Date.now() < cached.expiresAt - 60_000) {
    return cached.token;
  }

  const jwt = createAppJwt();
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (!response.ok) {
    throw new GitHubAuthError(`installation_token_failed_${response.status}`);
  }

  const data: unknown = await response.json();
  if (typeof data !== "object" || data === null) {
    throw new GitHubAuthError("installation_token_invalid_response");
  }

  const record = data as { token?: unknown; expires_at?: unknown };
  if (typeof record.token !== "string") {
    throw new GitHubAuthError("installation_token_missing");
  }

  const expiresAt =
    typeof record.expires_at === "string"
      ? new Date(record.expires_at).getTime()
      : Date.now() + 55 * 60_000;

  cache.set(installationId, { token: record.token, expiresAt });
  return record.token;
}

/** GitHub bağlantısı kaldırıldığında önbelleği temizle. */
export function clearInstallationToken(installationId: number): void {
  cache.delete(installationId);
}
