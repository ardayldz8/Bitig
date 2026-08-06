import { NextResponse } from "next/server";
import { env, githubAppStatus } from "@/lib/env";

export const runtime = "nodejs";

/**
 * GitHub App kurulum sayfasına yönlendirir.
 * OAuth App değil GitHub App kullanılır: kullanıcı hesap/organizasyon ve
 * erişim verilecek repository'leri GitHub arayüzünde seçer.
 */
export async function GET() {
  const status = githubAppStatus();
  if (!status.configured) {
    return NextResponse.json(
      {
        error: "GitHub entegrasyonu yapılandırılmamış.",
        missing: status.missing,
      },
      { status: 503 },
    );
  }

  const slug = env.githubAppSlug();
  const target = `https://github.com/apps/${encodeURIComponent(slug)}/installations/new`;

  return NextResponse.redirect(target);
}
