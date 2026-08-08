"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  bumpAttempts,
  dequeue,
  isQueueSupported,
  listQueued,
  queueSize,
} from "@/lib/offline/queue";

export type OfflineQueueState = {
  /** Bekleyen yazma sayısı. 0 ise arayüzde hiçbir şey gösterilmiyor. */
  pending: number;
  flushing: boolean;
  /** Elle tetikleme — kullanıcı "şimdi gönder" derse. */
  flush: () => Promise<void>;
};

/**
 * Kuyruktaki yazmaları bağlantı gelince gönderir.
 *
 * `online` olayı tek başına yeterli değil: tarayıcı ağı "var" sayarken
 * bağlantı hâlâ çalışmıyor olabiliyor (otel wifi'ı, captive portal).
 * Bu yüzden hem olayda hem sayfa öne geldiğinde deneniyor.
 */
export function useOfflineQueue(): OfflineQueueState {
  const { client, userId } = useAuth();
  const [pending, setPending] = useState(0);
  const [flushing, setFlushing] = useState(false);

  const sayimiTazele = useCallback(async () => {
    if (!isQueueSupported()) return;
    try {
      setPending(await queueSize());
    } catch {
      // Kuyruk okunamıyorsa sayaç gösterilmez; uygulama çalışmaya devam eder
    }
  }, []);

  const flush = useCallback(async () => {
    if (!isQueueSupported() || !client || !userId) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    setFlushing(true);
    try {
      const bekleyenler = await listQueued();

      for (const item of bekleyenler) {
        try {
          const tablo = client.from(item.table);
          let hata: { message: string } | null = null;

          if (item.op === "insert") {
            ({ error: hata } = await tablo.insert({ ...item.payload, user_id: userId }));
          } else if (item.op === "update" && item.matchId) {
            ({ error: hata } = await tablo.update(item.payload).eq("id", item.matchId));
          } else if (item.op === "delete" && item.matchId) {
            ({ error: hata } = await tablo.delete().eq("id", item.matchId));
          } else {
            // Eksik matchId ile kuyruğa girmiş bozuk kayıt: tekrar denenmesi anlamsız
            await dequeue(item.id);
            continue;
          }

          if (hata) await bumpAttempts(item);
          else await dequeue(item.id);
        } catch {
          await bumpAttempts(item);
        }
      }
    } finally {
      setFlushing(false);
      await sayimiTazele();
    }
  }, [client, userId, sayimiTazele]);

  useEffect(() => {
    void sayimiTazele();

    const tetikle = () => void flush();

    window.addEventListener("online", tetikle);
    /*
     * Sayfa öne geldiğinde de deneniyor: kullanıcı uygulamayı arka plana
     * atıp sinyal gelen bir yere geçmiş olabilir ve `online` olayı arka
     * planda kaçırılmış olabilir.
     */
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") tetikle();
    });

    // Açılışta bir kez: önceki oturumdan kalan kayıtlar bekliyor olabilir
    tetikle();

    return () => {
      window.removeEventListener("online", tetikle);
    };
  }, [flush, sayimiTazele]);

  return { pending, flushing, flush };
}
