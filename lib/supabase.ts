import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // Geliştirme sırasında erken uyarı
  console.warn(
    "Supabase ortam değişkenleri eksik. .env.local içinde NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlı olmalı."
  );
}

export const supabase = createClient(url ?? "", anon ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Magic link geri dönüşünde URL'deki kodu otomatik işle
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});
