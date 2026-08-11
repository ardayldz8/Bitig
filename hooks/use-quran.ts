"use client";

import { useCallback, useMemo } from "react";
import { useCloudCollection } from "@/hooks/use-cloud-collection";
import type { Row } from "@/lib/cloud/mappers";
import { createId } from "@/lib/ids";
import { DEFAULT_EDITIONS } from "@/lib/quran/editions";
import {
  DEFAULT_TIMES,
  type Confirmation,
  type DeliveredTranslation,
  type Delivery,
  type QuranSettings,
  type Slot,
} from "@/types/quran";

/** Tarayıcının saat dilimi; bildirim o dilime göre tetiklenir. */
function yerelDilim(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Istanbul";
  } catch {
    return "Europe/Istanbul";
  }
}

function gecerliTeyit(value: unknown): Confirmation {
  return value === "confirmed" || value === "differs" ? value : "unavailable";
}

function rowToDelivery(row: Row): Delivery | null {
  const id = row.id;
  const arabic = row.arabic;
  if (typeof id !== "string" || typeof arabic !== "string") return null;

  /*
   * `translations` jsonb; sunucudan geldiği için biçimine güvenmek yerine
   * tek tek doğrulanıyor. Bozuk bir kayıt listeyi tamamen düşürmemeli.
   */
  const ham = Array.isArray(row.translations) ? row.translations : [];
  const translations: DeliveredTranslation[] = [];
  for (const item of ham) {
    if (typeof item !== "object" || item === null) continue;
    const t = item as Record<string, unknown>;
    if (typeof t.text !== "string" || t.text.length === 0) continue;
    translations.push({
      edition: typeof t.edition === "string" ? t.edition : "",
      name: typeof t.name === "string" ? t.name : "",
      text: t.text,
      confirmation: gecerliTeyit(t.confirmation),
    });
  }

  return {
    id,
    surah: Number(row.surah) || 0,
    ayah: Number(row.ayah) || 0,
    surahName: typeof row.surah_name === "string" ? row.surah_name : "",
    surahNameLatin: typeof row.surah_name_latin === "string" ? row.surah_name_latin : "",
    arabic,
    translations,
    arabicSources: Array.isArray(row.arabic_sources)
      ? (row.arabic_sources as unknown[]).filter((s): s is string => typeof s === "string")
      : [],
    sentAt: typeof row.sent_at === "string" ? row.sent_at : "",
    saved: row.saved === true,
    savedAt: typeof row.saved_at === "string" ? row.saved_at : null,
    note: typeof row.note === "string" ? row.note : "",
  };
}

function rowToSlot(row: Row): Slot | null {
  const id = row.id;
  const time = row.time_of_day;
  if (typeof id !== "string" || typeof time !== "string") return null;
  // Postgres "08:00:00" döndürüyor; arayüzde saniye gösterilmiyor
  return { id, timeOfDay: time.slice(0, 5) };
}

function rowToSettings(row: Row): QuranSettings | null {
  if (typeof row.user_id !== "string") return null;
  const editions = Array.isArray(row.editions)
    ? (row.editions as unknown[]).filter((e): e is string => typeof e === "string")
    : [];
  return {
    enabled: row.enabled !== false,
    editions: editions.length > 0 ? editions : [...DEFAULT_EDITIONS],
    timezone: typeof row.timezone === "string" ? row.timezone : "Europe/Istanbul",
  };
}

export type QuranLibrary = {
  settings: QuranSettings | null;
  slots: Slot[];
  deliveries: Delivery[];
  saved: Delivery[];
  hydrated: boolean;
  error: string | null;

  /** İlk kurulum: varsayılan saatlerle aç. */
  enable: () => void;
  setEnabled: (value: boolean) => void;
  setEditions: (editions: string[]) => void;

  addSlot: (timeOfDay: string) => void;
  removeSlot: (id: string) => void;

  toggleSaved: (id: string) => void;
  setNote: (id: string, note: string) => void;
};

export function useQuran(): QuranLibrary {
  /*
   * Ayar tek satır ama koleksiyon makinesi kullanılıyor: iyimser güncelleme,
   * hata geri alma ve Realtime tazeleme zaten burada çözülmüş. Ayrı bir yol
   * yazmak aynı sorunları yeniden çözmek olurdu.
   */
  const settingsCollection = useCloudCollection<QuranSettings>({
    table: "quran_settings",
    orderColumn: "created_at",
    toItem: rowToSettings,
  });

  const slotCollection = useCloudCollection<Slot>({
    table: "quran_slots",
    orderColumn: "time_of_day",
    ascending: true,
    toItem: rowToSlot,
  });

  const deliveryCollection = useCloudCollection<Delivery>({
    table: "quran_deliveries",
    orderColumn: "sent_at",
    toItem: rowToDelivery,
  });

  const { mutate: mutateSettings } = settingsCollection;
  const { mutate: mutateSlots } = slotCollection;
  const { mutate: mutateDeliveries } = deliveryCollection;

  const settings = settingsCollection.items[0] ?? null;

  const yaz = useCallback(
    (next: QuranSettings, failMessage: string) => {
      mutateSettings(
        () => [next],
        (client, userId) =>
          client.from("quran_settings").upsert(
            {
              user_id: userId,
              enabled: next.enabled,
              editions: next.editions,
              timezone: next.timezone,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          ),
        failMessage,
      );
    },
    [mutateSettings],
  );

  const enable = useCallback(() => {
    yaz(
      { enabled: true, editions: [...DEFAULT_EDITIONS], timezone: yerelDilim() },
      "Ayarlar kaydedilemedi",
    );

    // Varsayılan vakitler — yalnızca hiç saat yoksa
    mutateSlots(
      (previous) =>
        previous.length > 0
          ? previous
          : DEFAULT_TIMES.map((t) => ({ id: createId(), timeOfDay: t })),
      (client, userId, next) => {
        const eklenecek = next.map((slot) => ({
          id: slot.id,
          user_id: userId,
          time_of_day: `${slot.timeOfDay}:00`,
        }));
        if (eklenecek.length === 0) return Promise.resolve({ error: null });
        /*
         * `ignoreDuplicates`: aynı saat zaten varsa unique kısıtı hata verir
         * ve iyimser güncelleme geri alınırdı. Kurulum iki kez tetiklenirse
         * (çift tık, iki sekme) sessizce geçmesi doğru davranış.
         */
        return client
          .from("quran_slots")
          .upsert(eklenecek, { onConflict: "user_id,time_of_day", ignoreDuplicates: true });
      },
      "Saatler kaydedilemedi",
    );
  }, [yaz, mutateSlots]);

  const setEnabled = useCallback(
    (value: boolean) => {
      yaz(
        {
          enabled: value,
          editions: settings?.editions ?? [...DEFAULT_EDITIONS],
          timezone: settings?.timezone ?? yerelDilim(),
        },
        value ? "Açılamadı" : "Kapatılamadı",
      );
    },
    [yaz, settings],
  );

  const setEditions = useCallback(
    (editions: string[]) => {
      if (editions.length === 0) return; // en az bir meal şart (veritabanı kısıtı)
      yaz(
        {
          enabled: settings?.enabled ?? true,
          editions,
          timezone: settings?.timezone ?? yerelDilim(),
        },
        "Meal seçimi kaydedilemedi",
      );
    },
    [yaz, settings],
  );

  const addSlot = useCallback(
    (timeOfDay: string) => {
      const slot: Slot = { id: createId(), timeOfDay };
      mutateSlots(
        (previous) =>
          previous.some((s) => s.timeOfDay === timeOfDay)
            ? previous
            : [...previous, slot].sort((a, b) => a.timeOfDay.localeCompare(b.timeOfDay)),
        (client, userId, next) => {
          if (!next.some((s) => s.id === slot.id)) return Promise.resolve({ error: null });
          return client
            .from("quran_slots")
            .insert({ id: slot.id, user_id: userId, time_of_day: `${timeOfDay}:00` });
        },
        "Saat eklenemedi",
      );
    },
    [mutateSlots],
  );

  const removeSlot = useCallback(
    (id: string) => {
      mutateSlots(
        (previous) => previous.filter((s) => s.id !== id),
        (client) => client.from("quran_slots").delete().eq("id", id),
        "Saat silinemedi",
      );
    },
    [mutateSlots],
  );

  const toggleSaved = useCallback(
    (id: string) => {
      mutateDeliveries(
        (previous) =>
          previous.map((d) =>
            d.id === id
              ? { ...d, saved: !d.saved, savedAt: !d.saved ? new Date().toISOString() : null }
              : d,
          ),
        (client, _userId, next) => {
          const item = next.find((d) => d.id === id);
          if (!item) return Promise.resolve({ error: null });
          return client
            .from("quran_deliveries")
            .update({ saved: item.saved, saved_at: item.savedAt })
            .eq("id", id);
        },
        "Kaydedilemedi",
      );
    },
    [mutateDeliveries],
  );

  const setNote = useCallback(
    (id: string, note: string) => {
      mutateDeliveries(
        (previous) => previous.map((d) => (d.id === id ? { ...d, note } : d)),
        (client) => client.from("quran_deliveries").update({ note }).eq("id", id),
        "Not kaydedilemedi",
      );
    },
    [mutateDeliveries],
  );

  const saved = useMemo(
    () =>
      deliveryCollection.items
        .filter((d) => d.saved)
        .sort((a, b) => (b.savedAt ?? "").localeCompare(a.savedAt ?? "")),
    [deliveryCollection.items],
  );

  return {
    settings,
    slots: slotCollection.items,
    deliveries: deliveryCollection.items,
    saved,
    hydrated: settingsCollection.hydrated && slotCollection.hydrated && deliveryCollection.hydrated,
    error: settingsCollection.error ?? slotCollection.error ?? deliveryCollection.error,
    enable,
    setEnabled,
    setEditions,
    addSlot,
    removeSlot,
    toggleSaved,
    setNote,
  };
}
