import { supabase } from "./supabase";

/** AI uç noktalarına yetkili istek için başlıklar (oturum token'ı dahil). */
export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
