import { NextResponse } from "next/server";
import { z } from "zod";
import { githubAppStatus } from "@/lib/env";
import { GitHubApiError, githubRequest } from "@/lib/github/client";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({
  installationId: z.number().int().positive(),
  fullName: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  title: z.string().trim().min(1).max(250),
  body: z.string().max(20_000).default(""),
  labels: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  /**
   * Kullanıcının açık onayı. AI veya arayüz bu bayrağı kendiliğinden GÖNDEREMEZ;
   * yalnızca kullanıcı onay diyaloğunda "GitHub issue oluştur" dediğinde true olur.
   */
  confirmed: z.literal(true),
});

/**
 * GitHub issue oluşturur — TEK yazma işlemi.
 *
 * `confirmed: true` olmadan istek reddedilir. AI bu uca doğrudan erişemez;
 * yalnızca taslak üretir, taslağı kullanıcı onaylar.
 */
export async function POST(request: Request) {
  const status = githubAppStatus();
  if (!status.configured) {
    return NextResponse.json(
      { error: "GitHub entegrasyonu yapılandırılmamış.", missing: status.missing },
      { status: 503 },
    );
  }

  const limit = checkRateLimit(clientKey(request, "gh-issue"), 10, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Çok fazla istek. Biraz bekleyip tekrar dene." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    const missingConfirmation = parsed.error.issues.some(
      (issue) => issue.path[0] === "confirmed",
    );
    return NextResponse.json(
      {
        error: missingConfirmation
          ? "Issue oluşturmak için açık kullanıcı onayı gerekli."
          : "Issue taslağı doğrulanamadı.",
      },
      { status: missingConfirmation ? 403 : 400 },
    );
  }

  try {
    const created = await githubRequest<{ number?: number; html_url?: string }>(
      parsed.data.installationId,
      `/repos/${parsed.data.fullName}/issues`,
      {
        method: "POST",
        body: {
          title: parsed.data.title,
          body: parsed.data.body,
          labels: parsed.data.labels,
        },
      },
    );

    return NextResponse.json({
      issue: {
        number: created.number ?? null,
        htmlUrl: created.html_url ?? null,
      },
    });
  } catch (error) {
    if (error instanceof GitHubApiError) {
      if (error.rateLimited) {
        return NextResponse.json(
          { error: "GitHub API limiti nedeniyle daha sonra tekrar dene." },
          { status: 429 },
        );
      }
      if (error.status === 403 || error.status === 404) {
        return NextResponse.json(
          {
            error:
              "Issue oluşturulamadı. GitHub App'e 'Issues: Read & Write' izni verilmiş mi kontrol et.",
          },
          { status: 403 },
        );
      }
    }
    return NextResponse.json({ error: "GitHub issue oluşturulamadı." }, { status: 502 });
  }
}
