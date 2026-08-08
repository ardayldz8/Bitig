import { NextResponse } from "next/server";
import { env, githubAppStatus } from "@/lib/env";

export const runtime = "nodejs";

/**
 * GitHub App kurulumundan dönüş (Setup URL).
 *
 * Burada veritabanına YAZILMAZ: `github_installations.user_id` zorunlu ama
 * GitHub'dan dönüşte hangi kullanıcının oturumu olduğu güvenilir biçimde
 * bilinemez. Kayıt, kullanıcı uygulamaya döndüğünde kendi token'ıyla
 * `POST /api/github/installation` üzerinden oluşturulur.
 *
 * Bu uç yalnızca installation_id'yi doğrulayıp arayüze taşır.
 */
export async function GET(request: Request) {
  if (!githubAppStatus().configured) {
    return redirectWithError("github_not_configured");
  }

  const url = new URL(request.url);
  const installationIdRaw = url.searchParams.get("installation_id");
  const installationId = Number(installationIdRaw);

  if (!installationIdRaw || !Number.isInteger(installationId) || installationId <= 0) {
    return redirectWithError("missing_installation");
  }

  const redirect = new URL("/repolar", env.appUrl());
  redirect.searchParams.set("github", "connected");
  redirect.searchParams.set("installation_id", String(installationId));
  return NextResponse.redirect(redirect.toString());
}

function redirectWithError(code: string) {
  const redirect = new URL("/repolar", env.appUrl());
  redirect.searchParams.set("github", "error");
  redirect.searchParams.set("reason", code);
  return NextResponse.redirect(redirect.toString());
}
