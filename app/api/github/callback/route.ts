import { NextResponse } from "next/server";
import { env, githubAppStatus } from "@/lib/env";
import { githubRequest } from "@/lib/github/client";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GitHub App kurulumundan dönüş.
 * installation_id YALNIZCA sunucu tarafında saklanır; tarayıcıya token gitmez.
 */
export async function GET(request: Request) {
  const status = githubAppStatus();
  if (!status.configured) {
    return redirectWithError("github_not_configured");
  }

  const url = new URL(request.url);
  const installationIdRaw = url.searchParams.get("installation_id");
  const installationId = Number(installationIdRaw);

  if (!installationIdRaw || !Number.isInteger(installationId)) {
    return redirectWithError("missing_installation");
  }

  try {
    // Kurulumun gerçekten var olduğunu ve hangi hesaba ait olduğunu doğrula
    const installation = await githubRequest<{
      account?: { login?: string; type?: string };
    }>(installationId, `/app/installations/${installationId}`).catch(() => null);

    const accountLogin = installation?.account?.login ?? "bilinmiyor";
    const accountType = installation?.account?.type ?? "User";

    // Supabase yapılandırılmışsa kaydı kalıcı yaz.
    // Kullanıcı oturumu callback'te güvenilir biçimde okunamayacağı için
    // eşleştirme, kullanıcı sayfaya döndüğünde tamamlanır.
    const admin = createAdminClient();
    if (admin) {
      await admin
        .from("github_installations")
        .upsert(
          {
            installation_id: installationId,
            account_login: accountLogin,
            account_type: accountType,
          },
          { onConflict: "installation_id" },
        )
        .select()
        .maybeSingle();
    }

    const redirect = new URL("/projeler", env.appUrl());
    redirect.searchParams.set("github", "connected");
    redirect.searchParams.set("installation_id", String(installationId));
    redirect.searchParams.set("account", accountLogin);
    return NextResponse.redirect(redirect.toString());
  } catch {
    return redirectWithError("callback_failed");
  }
}

function redirectWithError(code: string) {
  const redirect = new URL("/projeler", env.appUrl());
  redirect.searchParams.set("github", "error");
  redirect.searchParams.set("reason", code);
  return NextResponse.redirect(redirect.toString());
}
