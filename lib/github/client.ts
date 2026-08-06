import { getInstallationToken } from "@/lib/github/installation-token";

const API = "https://api.github.com";
const TIMEOUT_MS = 15_000;

export class GitHubApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly rateLimited: boolean = false,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

export type RateLimitInfo = {
  remaining: number | null;
  limit: number | null;
  resetAt: Date | null;
};

let lastRateLimit: RateLimitInfo = { remaining: null, limit: null, resetAt: null };

export function lastKnownRateLimit(): RateLimitInfo {
  return lastRateLimit;
}

function readRateLimit(headers: Headers): void {
  const remaining = Number(headers.get("x-ratelimit-remaining"));
  const limit = Number(headers.get("x-ratelimit-limit"));
  const reset = Number(headers.get("x-ratelimit-reset"));

  lastRateLimit = {
    remaining: Number.isFinite(remaining) ? remaining : null,
    limit: Number.isFinite(limit) ? limit : null,
    resetAt: Number.isFinite(reset) ? new Date(reset * 1000) : null,
  };
}

/**
 * Installation token ile kimliklenmiş GitHub REST çağrısı.
 * Token yalnızca burada, sunucu tarafında kullanılır.
 */
export async function githubRequest<T>(
  installationId: number,
  path: string,
  init?: { method?: string; body?: unknown; signal?: AbortSignal },
): Promise<T> {
  const token = await getInstallationToken(installationId);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  init?.signal?.addEventListener("abort", onAbort);

  try {
    const response = await fetch(`${API}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });

    readRateLimit(response.headers);

    if (!response.ok) {
      const rateLimited =
        response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0";
      throw new GitHubApiError(`github_${response.status}`, response.status, rateLimited);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
    init?.signal?.removeEventListener("abort", onAbort);
  }
}

/** Hata yoksa veri, varsa null — zincirin tek bir uç yüzünden kırılmaması için. */
export async function githubRequestSafe<T>(
  installationId: number,
  path: string,
): Promise<T | null> {
  try {
    return await githubRequest<T>(installationId, path);
  } catch {
    return null;
  }
}

/** Base64 kodlu dosya içeriğini metne çevirir (binary ise null). */
export function decodeContent(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const file = payload as { content?: unknown; encoding?: unknown; size?: unknown };
  if (typeof file.content !== "string" || file.encoding !== "base64") return null;

  const buffer = Buffer.from(file.content, "base64");
  // NUL baytı içeren dosyalar binary kabul edilir ve okunmaz
  if (buffer.includes(0)) return null;
  return buffer.toString("utf8");
}
