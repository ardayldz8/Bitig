"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
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
  ) => void;
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
  const toItemRef = useRef(toItem);
  toItemRef.current = toItem;

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
    (optimistic, persist, failMessage) => {
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
