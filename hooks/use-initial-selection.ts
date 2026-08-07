"use client";

import { useEffect, useRef } from "react";

/**
 * Liste yüklendiğinde ilk kaydı seçer — YALNIZCA BİR KEZ.
 *
 * Kendi hook'una çıkarıldı çünkü buradaki tek karar ("bir kez") kolayca
 * kaybolan türden ve kaybolunca sessiz bir hataya dönüşüyor: "Projelere dön"
 * düğmesi seçimi temizliyordu, effect aynı anda ilk projeyi geri seçiyordu ve
 * düğme hiç tepki vermemiş gibi görünüyordu. Ayrı hook olunca davranış
 * doğrudan test edilebiliyor.
 */
export function useInitialSelection(input: {
  /** Liste sunucudan yüklendi mi — boş liste ile "henüz gelmedi" ayrımı için. */
  hydrated: boolean;
  /** Seçilecek ilk kaydın id'si; liste boşsa null. */
  firstId: string | null;
  /** Şu an seçili olan (derin bağlantıyla gelinmiş olabilir). */
  selectedId: string | null;
  onSelect: (id: string) => void;
}): void {
  const { hydrated, firstId, selectedId, onSelect } = input;
  const karardanGecti = useRef(false);

  useEffect(() => {
    if (karardanGecti.current || !hydrated) return;

    /*
     * Bayrak, liste BOŞ olsa bile hydrate anında kapanıyor.
     *
     * Yalnızca seçim yapıldığında kapatılsaydı, ilk kayıt oluşturulana kadar
     * açık kalırdı: kullanıcı ilk projesini oluşturup listeye dönmek
     * istediğinde effect yeniden tetiklenip aynı hatayı üretirdi.
     */
    karardanGecti.current = true;

    if (selectedId || firstId === null) return;
    onSelect(firstId);
  }, [hydrated, firstId, selectedId, onSelect]);
}
