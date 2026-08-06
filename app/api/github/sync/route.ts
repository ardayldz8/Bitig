import { NextResponse } from "next/server";
import { z } from "zod";
import { githubAppStatus } from "@/lib/env";
import { GitHubApiError } from "@/lib/github/client";
import { assertInstallationAccess } from "@/lib/github/ownership";
import { syncRepository } from "@/lib/github/sync-repository";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  installationId: z.number().int().positive(),
  fullName: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
});

/**
 * Manuel repository senkronizasyonu.
 * Aynı kullanıcı + proje için kısa aralıklı tekrar istekleri engellenir.
 */
export async function POST(request: Request) {
  const status = githubAppStatus();
  if (!status.configured) {
    return NextResponse.json(
      { error: "GitHub entegrasyonu yapılandırılmamış.", missing: status.missing },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz senkronizasyon isteği." }, { status: 400 });
  }

  const access = await assertInstallationAccess(request, parsed.data.installationId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  // Proje bazlı spam koruması: 60 sn içinde en fazla 2 senkronizasyon
  const limit = checkRateLimit(
    `${clientKey(request, "gh-sync")}:${parsed.data.fullName}`,
    2,
    60_000,
  );
  if (!limit.ok) {
    return NextResponse.json(
      {
        error: `Bu proje çok sık senkronize edildi. ${limit.retryAfterSeconds} sn sonra tekrar dene.`,
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const snapshot = await syncRepository(parsed.data.installationId, parsed.data.fullName);
    return NextResponse.json({ snapshot });
  } catch (error) {
    if (error instanceof GitHubApiError && error.rateLimited) {
      return NextResponse.json(
        { error: "GitHub API limiti nedeniyle daha sonra tekrar dene." },
        { status: 429 },
      );
    }
    return NextResponse.json({ error: "Repository senkronize edilemedi." }, { status: 502 });
  }
}
