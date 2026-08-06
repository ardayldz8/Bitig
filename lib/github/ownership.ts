import { supabasePublicStatus } from "@/lib/env";
import { createServerClient, readAccessToken } from "@/lib/supabase/server";

export type OwnershipResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * `installationId` isteği yapan kullanıcıya mı ait?
 *
 * Bu kontrol olmadan installation id'yi bilen/deneyen herkes başkasının
 * repository'lerini bu uçlar üzerinden okuyabilirdi — id'ler gizli değil,
 * artan tamsayılar.
 *
 * Sorgu kullanıcının kendi token'ıyla yapılır; RLS devrede olduğu için
 * başkasının kaydı hiç dönmez. Yani kontrol tek bir yerde (veritabanı
 * politikası) uygulanır, burada yalnızca sonucu okunur.
 *
 * Supabase yapılandırılmamışsa (yerel mod) sahiplik kaydı hiç tutulmuyordur;
 * o kurulumda oturum kavramı da yoktur ve uygulama yalnızca localhost'ta
 * çalışır. Bu durumda kontrol atlanır.
 */
export async function assertInstallationAccess(
  request: Request,
  installationId: number,
): Promise<OwnershipResult> {
  if (!supabasePublicStatus().configured) return { ok: true };

  const token = readAccessToken(request);
  if (!token) {
    return { ok: false, status: 401, error: "Bu işlem için giriş yapmalısın." };
  }

  const client = createServerClient(token);
  if (!client) {
    return { ok: false, status: 503, error: "Supabase yapılandırılmamış." };
  }

  const { data, error } = await client
    .from("github_installations")
    .select("installation_id")
    .eq("installation_id", installationId)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 502, error: "GitHub kurulumu doğrulanamadı." };
  }
  if (!data) {
    return { ok: false, status: 403, error: "Bu GitHub kurulumuna erişimin yok." };
  }

  return { ok: true };
}
