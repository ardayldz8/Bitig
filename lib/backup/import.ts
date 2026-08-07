import type { SupabaseClient } from "@supabase/supabase-js";
import { BACKUP_VERSION, type Backup } from "@/lib/backup/export";

/**
 * Yedek dosyasından geri yükleme.
 *
 * Dışa aktarma tek başına yarım bir güvenlik ağı: elinizde veri olur ama geri
 * koyacak yol olmaz. Bu modül o boşluğu kapatır.
 */

/**
 * Yazma sırası. Ebeveyn tablolar önce gider, yoksa yabancı anahtar kısıtı
 * çocukları reddeder. `project_notes` ve `project_tasks`, `project_features`e
 * referans verdiği için onlardan sonra gelir.
 */
const RESTORE_ORDER = [
  "mangas",
  "media_entries",
  "food_entries",
  "nutrition_targets",
  // notes önce: note_reminders ona yabancı anahtarla bağlı
  "notes",
  "note_reminders",
  "subscriptions",
  "projects",
  "project_features",
  "project_notes",
  "project_tasks",
  "project_activities",
  "ai_project_snapshots",
] as const;

/** `user_id` taşıyan tablolar — değer dosyadan değil, açık oturumdan alınır. */
const USER_SCOPED = new Set<string>([
  "mangas",
  "media_entries",
  "food_entries",
  "nutrition_targets",
  "notes",
  "note_reminders",
  "subscriptions",
  "projects",
]);

/**
 * Geri yüklenmeyen tablolar ve sebepleri.
 *
 * GitHub verisi bilerek dışarıda: kurulum tek tıkla yeniden bağlanıyor,
 * anlık görüntüler "Senkronize et" ile yeniden çekiliyor. Üstelik
 * `github_installations.installation_id` benzersiz — başka bir hesaba ait
 * kurulumu geri yüklemeye çalışmak çakışma üretirdi.
 */
export const SKIPPED_TABLES = [
  "github_installations",
  "github_repositories",
  "github_commits",
  "github_pull_requests",
  "github_issues",
  "github_workflow_runs",
  "github_releases",
  "github_sync_states",
];

/** `nutrition_targets` birincil anahtarı `user_id`; diğerleri `id`. */
const CONFLICT_KEY: Record<string, string> = { nutrition_targets: "user_id" };

export type BackupSummary = {
  version: number;
  exportedAt: string | null;
  email: string | null;
  /** Geri yüklenecek tablolar ve kayıt sayıları. */
  counts: { table: string; rows: number }[];
  total: number;
  /** Dosyada olup geri yüklenmeyecek tablolar. */
  skipped: { table: string; rows: number }[];
};

export type ParseResult =
  | { ok: true; backup: Backup; summary: BackupSummary }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Dosyayı doğrular ve içeriğini özetler — yazmadan ÖNCE gösterilir. */
export function parseBackup(raw: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Dosya geçerli bir JSON değil." };
  }

  if (!isRecord(data) || !isRecord(data.tables)) {
    return { ok: false, error: "Bu bir Bitig yedek dosyası değil." };
  }

  const version = typeof data.version === "number" ? data.version : 0;
  if (version < 1 || version > BACKUP_VERSION) {
    return {
      ok: false,
      error: `Yedek sürümü desteklenmiyor (dosya: ${version}, beklenen: 1–${BACKUP_VERSION}).`,
    };
  }

  const tables = data.tables as Record<string, unknown>;
  const counts: BackupSummary["counts"] = [];
  const skipped: BackupSummary["skipped"] = [];

  for (const [table, rows] of Object.entries(tables)) {
    if (!Array.isArray(rows) || rows.length === 0) continue;
    if ((RESTORE_ORDER as readonly string[]).includes(table)) {
      counts.push({ table, rows: rows.length });
    } else {
      skipped.push({ table, rows: rows.length });
    }
  }

  const account = isRecord(data.account) ? data.account : {};

  return {
    ok: true,
    backup: data as unknown as Backup,
    summary: {
      version,
      exportedAt: typeof data.exportedAt === "string" ? data.exportedAt : null,
      email: typeof account.email === "string" ? account.email : null,
      counts,
      total: counts.reduce((sum, item) => sum + item.rows, 0),
      skipped,
    },
  };
}

export type RestoreResult = {
  written: { table: string; rows: number }[];
  errors: { table: string; message: string }[];
};

/**
 * Tüm satırları aynı anahtar kümesine getirir; eksik alanlar `null` olur.
 *
 * `select *` ile alınmış bir yedekte satırlar zaten tekdüzedir, ama dosya elle
 * düzenlenmiş ya da farklı bir şema sürümünden gelmiş olabilir.
 */
export function tekduzeleştir(
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  if (rows.length <= 1) return rows;

  const anahtarlar = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) anahtarlar.add(key);
  }

  return rows.map((row) => {
    const tam: Record<string, unknown> = {};
    for (const key of anahtarlar) tam[key] = key in row ? row[key] : null;
    return tam;
  });
}

/**
 * Kayıtları yazar.
 *
 * `upsert` kullanılır: aynı dosyayı iki kez yüklemek yinelenen kayıt üretmez,
 * mevcut kaydın üzerine aynı veriyi yazar. Kimlikler dosyadan korunur, yoksa
 * proje–özellik–not bağlantıları kopardı.
 */
export async function restoreBackup(
  client: SupabaseClient,
  userId: string,
  backup: Backup,
): Promise<RestoreResult> {
  const written: RestoreResult["written"] = [];
  const errors: RestoreResult["errors"] = [];

  for (const table of RESTORE_ORDER) {
    const rows = backup.tables?.[table];
    if (!Array.isArray(rows) || rows.length === 0) continue;

    // user_id dosyadan DEĞİL oturumdan gelir: yedek başka bir hesapta
    // alınmış ya da hesap yeniden oluşturulmuş olabilir.
    const hazir = rows
      .filter(isRecord)
      .map((row) => (USER_SCOPED.has(table) ? { ...row, user_id: userId } : { ...row }));

    // PostgREST toplu eklemede tüm nesnelerin AYNI anahtarlara sahip olmasını
    // ister; değilse "All object keys must match" ile tabloyu tamamen reddeder.
    // Farklı sürümde alınmış ya da elle düzenlenmiş dosya bu yüzden hiç
    // yüklenemezdi. Anahtar kümesi birleştirilip eksikler null'a tamamlanır.
    const payload = tekduzeleştir(hazir);

    const { error } = await client
      .from(table)
      .upsert(payload, { onConflict: CONFLICT_KEY[table] ?? "id" });

    if (error) {
      errors.push({ table, message: error.message });
      // Ebeveyn yazılamadıysa çocukları denemek anlamsız; ama diğer
      // bağımsız tablolar etkilenmesin diye döngü sürdürülür.
      continue;
    }

    written.push({ table, rows: payload.length });
  }

  return { written, errors };
}
