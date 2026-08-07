/**
 * Ortam değişkeni doğrulaması.
 *
 * Eksik değişken uygulamayı ÇÖKERTMEZ; ilgili entegrasyon "yapılandırılmamış"
 * olarak işaretlenir ve arayüzde kurulum uyarısı gösterilir.
 */

function read(name: string): string {
  return (process.env[name] ?? "").trim();
}

export type IntegrationStatus = {
  configured: boolean;
  /** Eksik olan değişken adları — kuruluma yönlendirmek için. */
  missing: string[];
};

const SUPABASE_PUBLIC = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];
const SUPABASE_ADMIN = [...SUPABASE_PUBLIC, "SUPABASE_SERVICE_ROLE_KEY"];
// Client ID/secret bilerek yok: kimlik doğrulama App ID + private key ile
// üretilen JWT üzerinden yürüyor. Client secret yalnızca kullanıcı OAuth
// akışında gerekir; uygulama onu kullanmıyor, bu yüzden hiç saklanmıyor.
const GITHUB_APP = ["GITHUB_APP_ID", "GITHUB_PRIVATE_KEY", "GITHUB_APP_SLUG"];

function check(names: string[]): IntegrationStatus {
  const missing = names.filter((name) => read(name).length === 0);
  return { configured: missing.length === 0, missing };
}

export function supabasePublicStatus(): IntegrationStatus {
  return check(SUPABASE_PUBLIC);
}

export function supabaseAdminStatus(): IntegrationStatus {
  return check(SUPABASE_ADMIN);
}

export function githubAppStatus(): IntegrationStatus {
  return check(GITHUB_APP);
}

export function githubWebhookStatus(): IntegrationStatus {
  return check(["GITHUB_WEBHOOK_SECRET"]);
}

export function openRouterStatus(): IntegrationStatus {
  return check(["OPENROUTER_API_KEY"]);
}

/**
 * Web Push. Açık anahtar tarayıcıya gidiyor (NEXT_PUBLIC_), gizli anahtar
 * yalnızca sunucuda imzalama için kullanılıyor. VAPID_SUBJECT push
 * servislerinin zorunlu tuttuğu iletişim adresi (mailto: veya https:).
 */
const WEB_PUSH = [
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
];

export function webPushStatus(): IntegrationStatus {
  return check(WEB_PUSH);
}

export const env = {
  supabaseUrl: () => read("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => read("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: () => read("SUPABASE_SERVICE_ROLE_KEY"),

  githubAppId: () => read("GITHUB_APP_ID"),
  githubAppSlug: () => read("GITHUB_APP_SLUG"),
  githubWebhookSecret: () => read("GITHUB_WEBHOOK_SECRET"),

  /**
   * Private key .env içinde tek satırda "\n" kaçışlarıyla tutulabilir.
   * PEM formatına geri çevrilir.
   */
  githubPrivateKey: () => read("GITHUB_PRIVATE_KEY").replace(/\\n/g, "\n"),

  openRouterKey: () => read("OPENROUTER_API_KEY"),
  projectModel: () => read("OPENROUTER_PROJECT_MODEL") || "google/gemini-3.5-flash",

  vapidPublicKey: () => read("NEXT_PUBLIC_VAPID_PUBLIC_KEY"),
  vapidPrivateKey: () => read("VAPID_PRIVATE_KEY"),
  vapidSubject: () => read("VAPID_SUBJECT"),

  /** pg_cron'un gönderim ucunu çağırırken kullandığı paylaşılan sır. */
  reminderDispatchSecret: () => read("REMINDER_DISPATCH_SECRET"),

  appUrl: () => read("NEXT_PUBLIC_APP_URL") || "http://localhost:3000",
};

/** Sayfanın istemciye güvenle gönderebileceği entegrasyon durumu. */
export type IntegrationsSnapshot = {
  supabase: boolean;
  github: boolean;
  githubWebhook: boolean;
  ai: boolean;
  appSlug: string;
};

export function integrationsSnapshot(): IntegrationsSnapshot {
  return {
    supabase: supabasePublicStatus().configured,
    github: githubAppStatus().configured,
    githubWebhook: githubWebhookStatus().configured,
    ai: openRouterStatus().configured,
    appSlug: env.githubAppSlug(),
  };
}
