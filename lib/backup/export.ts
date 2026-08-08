import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Tüm kullanıcı verisinin tek dosyalık yedeği.
 *
 * Veriler tek bir Supabase projesinde duruyor ve başka kopyası yok. Yanlış bir
 * migration ya da hesabın kaybı her şeyi götürür; bu yüzden dışarı alınabilir
 * olmaları gerekiyor.
 *
 * `version` alanı ileride içe aktarma yazılabilsin diye var: biçim değişirse
 * eski dosyalar hangi sürüme ait olduğunu söyleyebilir.
 */

export const BACKUP_VERSION = 1;

export type Backup = {
  version: number;
  exportedAt: string;
  account: { userId: string; email: string | null };
  tables: Record<string, unknown[]>;
  /** Okunamayan tablolar sessizce eksik kalmasın. */
  errors: Record<string, string>;
};

/**
 * Kullanıcıya doğrudan bağlı tablolar (`user_id` taşıyanlar).
 * Bunlar RLS ile zaten kullanıcıya kısıtlı.
 */
const USER_TABLES = [
  "mangas",
  "media_entries",
  "food_entries",
  "nutrition_targets",
  "notes",
  "note_reminders",
  "subscriptions",
  "repo_triage",
  "projects",
  "github_installations",
] as const;

/*
 * `repo_snapshots` yok: GitHub'dan çekilen salt okunur kopya, tek tuşla
 * yeniden üretiliyor. `repo_triage` VAR — o kişisel karar, başka yerde yok.
 *
 * `subscription_notices` de yok: hangi ödeme için hangi bildirimin
 * gönderildiğini tutan işletim kaydı, kullanıcı verisi değil. Geri
 * yüklendiğinde tek etkisi geçmiş bildirimlerin tekrarlanmaması olurdu —
 * o tarihler zaten geçmiş.
 *
 * `push_subscriptions` bilerek yok.
 *
 * Cihaza özgü: her abonelik belirli bir tarayıcının push servisindeki uca
 * bağlı. Başka bir cihaza geri yüklemek ölü uçlar yaratır ve gönderim işi
 * her dakika onlara boşuna istek atar. Kullanıcı yeni cihazda bildirimleri
 * tek tıkla yeniden açıyor zaten.
 */

/**
 * Projeye bağlı tablolar. RLS bunları da kullanıcıya kısıtlıyor (üst projenin
 * sahibi kontrol ediliyor), o yüzden ayrıca filtre gerekmez.
 *
 * `github_webhook_deliveries` bilerek yok: kullanıcı verisi değil, tekrar
 * saldırısını engellemek için tutulan iç kayıt.
 */
const PROJECT_TABLES = [
  "project_features",
  "project_notes",
  "project_tasks",
  "project_activities",
  "github_repositories",
  "github_commits",
  "github_pull_requests",
  "github_issues",
  "github_workflow_runs",
  "github_releases",
  "github_sync_states",
  "ai_project_snapshots",
] as const;

export async function buildBackup(
  client: SupabaseClient,
  userId: string,
  email: string | null,
): Promise<Backup> {
  const tables: Record<string, unknown[]> = {};
  const errors: Record<string, string> = {};

  const collect = async (table: string, scoped: boolean) => {
    const query = client.from(table).select("*");
    const { data, error } = scoped ? await query.eq("user_id", userId) : await query;

    if (error) {
      // Tek tablo okunamadıysa yedek yine de üretilir; eksik olan dosyada
      // "errors" altında görünür, sessizce kaybolmaz.
      errors[table] = error.message;
      return;
    }
    tables[table] = Array.isArray(data) ? data : [];
  };

  await Promise.all([
    ...USER_TABLES.map((table) => collect(table, true)),
    ...PROJECT_TABLES.map((table) => collect(table, false)),
  ]);

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    account: { userId, email },
    tables,
    errors,
  };
}

export function backupFileName(exportedAt: string): string {
  const date = new Date(exportedAt);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `bitig-yedek-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

/** Kaç kayıt yedeklendiğini özetler (kullanıcıya gösterilir). */
export function countRows(backup: Backup): number {
  return Object.values(backup.tables).reduce((total, rows) => total + rows.length, 0);
}
