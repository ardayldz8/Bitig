import { NextResponse } from "next/server";
import { z } from "zod";
import { githubAppStatus, supabasePublicStatus } from "@/lib/env";
import { appRequest, GitHubApiError } from "@/lib/github/client";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { createServerClient, readAccessToken } from "@/lib/supabase/server";

export const runtime = "nodejs";

type InstallationRow = {
  installation_id: number;
  account_login: string;
  account_type: string;
};

function toResponse(row: InstallationRow | null) {
  return {
    installation: row
      ? {
          installationId: row.installation_id,
          accountLogin: row.account_login,
          accountType: row.account_type,
        }
      : null,
  };
}

function requireClient(request: Request) {
  if (!supabasePublicStatus().configured) {
    return { error: NextResponse.json(toResponse(null)) } as const;
  }

  const token = readAccessToken(request);
  if (!token) {
    return {
      error: NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 }),
    } as const;
  }

  const client = createServerClient(token);
  if (!client) {
    return {
      error: NextResponse.json({ error: "Supabase yapılandırılmamış." }, { status: 503 }),
    } as const;
  }

  return { client } as const;
}

/**
 * Kullanıcının bağlı GitHub kurulumunu döner.
 *
 * Bağlantının URL parametresi yerine burada tutulmasının sebebi: parametre
 * sayfa yenilendiğinde kayboluyor ve kullanıcı her seferinde kurulum akışına
 * geri gönderiliyordu.
 */
export async function GET(request: Request) {
  const resolved = requireClient(request);
  if ("error" in resolved) return resolved.error;

  // RLS: yalnızca kendi kaydı döner
  const { data, error } = await resolved.client
    .from("github_installations")
    .select("installation_id, account_login, account_type")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Kurulum bilgisi okunamadı." }, { status: 502 });
  }

  return NextResponse.json(toResponse(data as InstallationRow | null));
}

const claimSchema = z.object({
  installationId: z.coerce.number().int().positive(),
});

/**
 * Kurulumu oturum açmış kullanıcıya bağlar.
 *
 * Callback bu kaydı yazamaz: `user_id` zorunlu ama GitHub'dan dönüşte hangi
 * kullanıcının tarayıcısı olduğu güvenilir biçimde bilinemez. Bu yüzden
 * eşleştirme, kullanıcı uygulamaya döndüğünde kendi token'ıyla yapılır.
 *
 * Sınır: kullanıcı OAuth akışı kapalı olduğu için istemcinin GitHub kimliği
 * doğrulanamıyor; kaydı ilk talep eden alır (`installation_id` unique).
 * Tek kullanıcılı kurulum için yeterli — uygulama başkalarına açılacaksa
 * GitHub kullanıcı yetkilendirmesi eklenmeli.
 */
export async function POST(request: Request) {
  const limit = checkRateLimit(clientKey(request, "gh-claim"), 10, 60_000);
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

  const resolved = requireClient(request);
  if ("error" in resolved) return resolved.error;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const parsed = claimSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz kurulum bilgisi." }, { status: 400 });
  }

  const installationId = parsed.data.installationId;

  // Kurulumun gerçekten var olduğunu ve hangi hesaba ait olduğunu GitHub'a sor.
  // App JWT gerekir; installation token bu ucu kabul etmez.
  let account = { login: "bilinmiyor", type: "User" };
  try {
    const installation = await appRequest<{
      account?: { login?: string; type?: string };
    }>(`/app/installations/${installationId}`);

    account = {
      login: installation.account?.login ?? "bilinmiyor",
      type: installation.account?.type ?? "User",
    };
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 404) {
      return NextResponse.json({ error: "Böyle bir kurulum yok." }, { status: 404 });
    }
    return NextResponse.json({ error: "Kurulum doğrulanamadı." }, { status: 502 });
  }

  // user_id gövdeden DEĞİL, doğrulanmış token'dan gelir.
  const { data: userData } = await resolved.client.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Oturum doğrulanamadı." }, { status: 401 });
  }

  const { data, error } = await resolved.client
    .from("github_installations")
    .upsert(
      {
        user_id: userId,
        installation_id: installationId,
        account_login: account.login,
        account_type: account.type,
      },
      { onConflict: "installation_id" },
    )
    .select("installation_id, account_login, account_type")
    .maybeSingle();

  if (error || !data) {
    // RLS, başkasına ait kaydın üzerine yazmayı engeller
    return NextResponse.json(
      { error: "Bu kurulum başka bir hesaba bağlı." },
      { status: 409 },
    );
  }

  return NextResponse.json(toResponse(data as InstallationRow));
}

/** GitHub bağlantısını kaldırır (yalnızca uygulama tarafındaki kayıt). */
export async function DELETE(request: Request) {
  const resolved = requireClient(request);
  if ("error" in resolved) return resolved.error;

  // Filtre zorunlu (koşulsuz delete reddedilir); kapsamı RLS belirliyor,
  // yani bu koşul yalnızca kullanıcının kendi kayıtlarına uygulanır.
  const { error } = await resolved.client
    .from("github_installations")
    .delete()
    .gt("installation_id", 0);

  if (error) {
    return NextResponse.json({ error: "Bağlantı kaldırılamadı." }, { status: 502 });
  }

  return NextResponse.json(toResponse(null));
}
