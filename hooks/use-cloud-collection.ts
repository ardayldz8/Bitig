"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { enqueue, isQueueSupported } from "@/lib/offline/queue";
import { useAuth } from "@/components/auth/auth-provider";
import type { Row } from "@/lib/cloud/mappers";

export type PersistResult = { error: PostgrestError | null };

export type CloudCollection<T> = {
  items: T[];
  /** İlk yükleme tamamlandı mı — boş liste ile "henüz yüklenmedi" ayrımı için. */
  hydrated: boolean;
  error: string | null;
  reload: () => Promise<void>;
  /**
   * Önce ekranı günceller, sonra sunucuya yazar. Yazma başarısızsa sunucudan
   * yeniden okunur; yani ekranda kalıcı olarak yanlış veri görünmez.
   */
  mutate: (
    optimistic: (previous: T[]) => T[],
    /**
     * `next`, optimistic uygulandıktan SONRAKİ liste. Çağıran taraf kendi
     * closure'ından okumamalı: art arda gelen değişikliklerde (ör. bölüm
     * sayacına hızlı iki tık) o değer bayat kalır ve ikinci yazma birinciyi
     * tekrarlar.
     *
     * PromiseLike: PostgREST sorgu kurucusu thenable'dır, tam Promise değil.
     */
    persist: (
      client: SupabaseClient,
      userId: string,
      next: T[],
    ) => PromiseLike<PersistResult>,
    failMessage: string,
    /**
     * Çevrimdışı kuyruk için yazmanın TARİFİ.
     *
     * `persist` bir fonksiyon olduğu için içinden tablo/işlem çıkarılamıyor;
     * kuyruğa yazabilmek çağıranın bunu açıkça söylemesini gerektiriyor.
     * Verilmezse eski davranış sürüyor: ağ hatasında değişiklik geri alınır.
     * Yarım bir kuyruk, "kaydedildi" deyip kaydetmemekten iyidir.
     */
    offline?: OfflineDescriptor,
  ) => void;
};

export type OfflineDescriptor = {
  table: string;
  op: "insert" | "update" | "delete";
  payload: Record<string, unknown>;
  matchId?: string;
};

/**
 * Kullanıcıya ait tek bir tablonun bulut karşılığı.
 *
 * Giriş duvarı sayesinde bu hook yalnızca oturum açıkken çalışır; yerel mod
 * yoktur. Oturum yoksa liste boş kalır ve yazma denenmez.
 */
export function useCloudCollection<T>({
  table,
  orderColumn,
  ascending = false,
  toItem,
}: {
  table: string;
  orderColumn: string;
  ascending?: boolean;
  toItem: (row: Row) => T | null;
}): CloudCollection<T> {
  const { client, userId } = useAuth();
  const [items, setItems] = useState<T[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  /*
   * Dönüştürücünün en güncel hâli. Ref'e render sırasında değil effect'te
   * yazılıyor: render sırasında ref güncellemek React'in eşzamanlı
   * modunda güvenli değil ve `react-hooks/refs` bunu haklı olarak uyarıyor.
   *
   * Effect'e taşımak burada sorun çıkarmıyor çünkü ref YALNIZCA reload()
   * içinde, yani mount sonrası asenkron bir noktada okunuyor.
   */
  const toItemRef = useRef(toItem);
  useEffect(() => {
    toItemRef.current = toItem;
  }, [toItem]);

  /**
   * Listenin senkron kopyası. React state'i bir sonraki render'a kadar
   * güncellenmediği için, art arda gelen mutate çağrıları state'ten okusaydı
   * hepsi aynı eski listeyi görürdü.
   */
  const itemsRef = useRef<T[]>([]);
  const commit = useCallback((next: T[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!client || !userId) return;

    const { data, error: queryError } = await client
      .from(table)
      .select("*")
      .eq("user_id", userId)
      .order(orderColumn, { ascending });

    if (!mountedRef.current) return;

    if (queryError) {
      // Supabase'in kendi mesajı korunur: "tablo yok" ile "ağ hatası" farklı
      // sorunlar, ikisini tek cümleye indirmek teşhisi engelliyor.
      setError(`Veriler yüklenemedi: ${queryError.message}`);
      setHydrated(true);
      return;
    }

    const rows = Array.isArray(data) ? (data as Row[]) : [];
    commit(rows.map(toItemRef.current).filter((item): item is T => item !== null));
    setError(null);
    setHydrated(true);
  }, [client, userId, table, orderColumn, ascending, commit]);

  // İlk yükleme + Realtime. Başka cihazdaki değişiklik buraya da yansır.
  useEffect(() => {
    if (!client || !userId) {
      commit([]);
      setHydrated(false);
      return;
    }

    void reload();

    // Kısa aralıklı olaylar (ör. tek seferde beş yemek eklenmesi) tek tazelemede
    // birleşsin diye küçük bir gecikme
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void reload(), 150);
    };

    const channel = client
      .channel(`bitig-${table}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` },
        scheduleReload,
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void client.removeChannel(channel);
    };
  }, [client, userId, table, reload, commit]);

  const mutate = useCallback<CloudCollection<T>["mutate"]>(
    (optimistic, persist, failMessage, offline) => {
      if (!client || !userId) {
        setError("Oturum bulunamadı, değişiklik kaydedilemedi.");
        return;
      }

      // Ref'ten okunur: aynı render içinde art arda gelen çağrılar birbirinin
      // sonucunu görür, yoksa ikincisi birincinin değişikliğini yok sayar.
      const snapshot = itemsRef.current;
      const next = optimistic(snapshot);
      commit(next);
      setError(null);

      void Promise.resolve(persist(client, userId, next))
        .then(({ error: writeError }) => {
          if (!mountedRef.current) return;
          if (writeError) {
            // Ekranı sunucuyla eşitle; iyimser değişikliği geri al
            commit(snapshot);
            setError(`${failMessage}: ${writeError.message}`);
            void reload();
          }
        })
        .catch((caught: unknown) => {
          if (!mountedRef.current) return;

          /*
           * Ağ hatasında değişiklik EKRANDA KALIYOR ve kuyruğa yazılıyor.
           *
           * Önce geri alınıyordu: metroda eklenen öğün gözünüzün önünde
           * kayboluyordu. Ağ hatası ile veri hatası farklı şeyler —
           * ikincisinde geri almak doğru, birincisinde kullanıcının emeğini
           * silmek oluyor.
           */
          const agHatasi =
            typeof navigator !== "undefined" &&
            (!navigator.onLine || caught instanceof TypeError);

          // Mesaj YALNIZCA gerçekten kuyruğa yazıldıysa gösteriliyor
          if (agHatasi && offline && isQueueSupported()) {
            void enqueue({
              id: `${offline.table}-${offline.matchId ?? Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              table: offline.table,
              op: offline.op,
              payload: offline.payload,
              matchId: offline.matchId,
            })
              .then(() =>
                setError("Bağlantı yok — değişiklik kaydedildi, bağlanınca gönderilecek."),
              )
              .catch(() => {
                commit(snapshot);
                setError("Bağlantı yok ve değişiklik yerel olarak da saklanamadı.");
              });
            return;
          }

          commit(snapshot);
          setError(
            caught instanceof Error ? `${failMessage}: ${caught.message}` : failMessage,
          );
        });
    },
    [client, userId, commit, reload],
  );

  return { items, hydrated, error, reload, mutate };
}
