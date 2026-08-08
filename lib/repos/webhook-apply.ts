import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPush, type PushSubscriptionRecord } from "@/lib/push/send";

/**
 * Webhook olayını repo envanterine uygular ve gerekiyorsa bildirim gönderir.
 *
 * Webhook, envanteri tam senkrondan çok daha taze tutuyor: elle "GitHub'dan
 * çek" demeyi beklemeden CI sonucu, son push ve açık PR sayısı güncelleniyor.
 *
 * YALNIZCA zaten envanterde olan repolar güncelleniyor. Yeni bir repo
 * eklendiğinde tam senkron gerekiyor — webhook'tan gelen veri bir repo
 * satırını baştan oluşturmaya yetmiyor (dil, açıklama, fork bilgisi yok) ve
 * eksik veriyle satır açmak listede yarım kayıtlar bırakırdı.
 */
export async function applyWebhookToInventory(
  admin: SupabaseClient,
  event: string,
  payload: unknown,
): Promise<void> {
  if (typeof payload !== "object" || payload === null) return;

  const govde = payload as {
    repository?: { full_name?: unknown };
    workflow_run?: { conclusion?: unknown; status?: unknown; updated_at?: unknown; html_url?: unknown; name?: unknown };
    action?: unknown;
  };

  const fullName =
    typeof govde.repository?.full_name === "string" ? govde.repository.full_name : null;
  if (!fullName) return;

  // Envanterde var mı — yoksa dokunulmaz
  const { data: mevcut } = await admin
    .from("repo_snapshots")
    .select("id, user_id, open_prs")
    .eq("full_name", fullName)
    .limit(1)
    .maybeSingle();

  if (!mevcut?.id) return;

  const guncelleme: Record<string, unknown> = {};
  let ciKirildi = false;
  let isAkisiAdi = "CI";

  if (event === "push") {
    guncelleme.pushed_at = new Date().toISOString();
  }

  if (event === "workflow_run") {
    const run = govde.workflow_run;
    // Yalnızca tamamlanmış çalıştırmalar; "in_progress" sonucu henüz yok
    if (run && run.status === "completed") {
      const sonuc = typeof run.conclusion === "string" ? run.conclusion : null;
      guncelleme.ci_conclusion = sonuc;
      guncelleme.ci_at =
        typeof run.updated_at === "string" ? run.updated_at : new Date().toISOString();

      if (sonuc === "failure") {
        ciKirildi = true;
        if (typeof run.name === "string" && run.name) isAkisiAdi = run.name;
      }
    }
  }

  if (event === "pull_request") {
    /*
     * Açık PR sayısı artırılıp azaltılıyor, yeniden sayılmıyor: webhook
     * payload'ı toplam sayıyı içermiyor ve her olayda GitHub'a sormak
     * gereksiz istek demek. Sapma olursa tam senkron düzeltiyor.
     */
    const aksiyon = govde.action;
    const simdiki = typeof mevcut.open_prs === "number" ? mevcut.open_prs : 0;
    if (aksiyon === "opened" || aksiyon === "reopened") {
      guncelleme.open_prs = simdiki + 1;
    } else if (aksiyon === "closed") {
      guncelleme.open_prs = Math.max(0, simdiki - 1);
    }
  }

  if (Object.keys(guncelleme).length > 0) {
    await admin.from("repo_snapshots").update(guncelleme).eq("id", mevcut.id);
  }

  if (!ciKirildi || typeof mevcut.user_id !== "string") return;

  // ------------------------------------------------------------- Bildirim

  const { data: cihazlar } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", mevcut.user_id);

  const hedefler = (cihazlar ?? []) as PushSubscriptionRecord[];
  if (hedefler.length === 0) return;

  const olenler: string[] = [];
  for (const hedef of hedefler) {
    const sonuc = await sendPush(hedef, {
      title: `${fullName} — CI kırıldı`,
      body: `${isAkisiAdi} başarısız oldu.`,
      url: "/repolar",
      /*
       * Repo başına tek tag: aynı repo art arda kırılırsa bildirimler
       * yığılmaz, sonuncusu öncekinin yerine geçer. Farklı repolar
       * birbirini ezmez.
       */
      tag: `ci-${fullName}`,
    });
    if (!sonuc.ok && sonuc.expired) olenler.push(hedef.id);
  }

  if (olenler.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", olenler);
  }
}
