import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, supabaseAdminStatus, supabasePublicStatus } from "@/lib/env";

/**
 * Sunucu tarafı Supabase istemcisi (kullanıcı token'ı ile).
 * RLS devrede kalır — kullanıcı yalnızca kendi kayıtlarına erişir.
 */
export function createServerClient(accessToken: string | null): SupabaseClient | null {
  if (!supabasePublicStatus().configured) return null;

  return createClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined,
  });
}

/** İstekteki Bearer token'ı okur. */
export function readAccessToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const token = header.replace(/^Bearer\s+/i, "").trim();
  return token.length > 0 ? token : null;
}

/** Token'ı doğrulayıp kullanıcı id'sini döner. */
export async function getUserId(request: Request): Promise<string | null> {
  const token = readAccessToken(request);
  if (!token) return null;

  const client = createServerClient(token);
  if (!client) return null;

  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

/**
 * Service role istemcisi — RLS'i BYPASS eder.
 * YALNIZCA webhook gibi kullanıcı oturumu olmayan sunucu işlerinde kullanılır.
 * Service role anahtarı hiçbir koşulda istemciye gönderilmez.
 */
export function createAdminClient(): SupabaseClient | null {
  if (!supabaseAdminStatus().configured) return null;

  return createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
