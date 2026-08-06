import { NextResponse } from "next/server";
import { z } from "zod";
import { githubAppStatus } from "@/lib/env";
import { githubRequest, GitHubApiError } from "@/lib/github/client";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

const querySchema = z.object({
  installationId: z.coerce.number().int().positive(),
});

/** GitHub App'in erişebildiği repository'leri listeler (yalnızca okuma). */
export async function GET(request: Request) {
  const limit = checkRateLimit(clientKey(request, "gh-repos"), 20, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Çok fazla istek. Biraz bekleyip tekrar dene." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const status = githubAppStatus();
  if (!status.configured) {
    return NextResponse.json(
      { error: "GitHub entegrasyonu yapılandırılmamış.", missing: status.missing },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    installationId: url.searchParams.get("installationId"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz installation bilgisi." }, { status: 400 });
  }

  try {
    const data = await githubRequest<{ repositories?: unknown[] }>(
      parsed.data.installationId,
      "/installation/repositories?per_page=100",
    );

    const repositories = (data.repositories ?? [])
      .map((item) => {
        if (typeof item !== "object" || item === null) return null;
        const repo = item as Record<string, unknown>;
        if (typeof repo.full_name !== "string") return null;
        return {
          fullName: repo.full_name,
          name: typeof repo.name === "string" ? repo.name : repo.full_name,
          description: typeof repo.description === "string" ? repo.description : null,
          isPrivate: repo.private === true,
          language: typeof repo.language === "string" ? repo.language : null,
          defaultBranch:
            typeof repo.default_branch === "string" ? repo.default_branch : "main",
          htmlUrl: typeof repo.html_url === "string" ? repo.html_url : "",
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return NextResponse.json({ repositories });
  } catch (error) {
    if (error instanceof GitHubApiError && error.rateLimited) {
      return NextResponse.json(
        { error: "GitHub API limiti nedeniyle daha sonra tekrar dene." },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "Repository listesi alınamadı." },
      { status: 502 },
    );
  }
}
