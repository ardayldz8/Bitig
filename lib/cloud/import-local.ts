"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { mangaToRow, mediaEntryToRow, } from "@/lib/cloud/mappers";
import { createId } from "@/lib/ids";
import { readMediaEntries } from "@/lib/media/storage";
import { readStoredMangas } from "@/lib/storage";

/**
 * Bu cihazda kalmış eski veriler.
 *
 * Manga, kalori ve dizi/film daha önce yalnızca localStorage'da tutuluyordu.
 * Buluta geçince o kayıtlar erişilemez hâle gelirdi; bu modül onları bir kez
 * hesaba taşır.
 *
 * Projeler kapsam dışı: yerel mod yalnızca Supabase yapılandırılmamışken
 * çalışıyordu ve orada tutulan tek şey örnek/demo veriydi.
 */

/** Aktarım teklifi reddedildiğinde işaretlenir; her açılışta tekrar sorulmasın. */
const DISMISSED_KEY = "bitig.import.dismissed.v1";

export type LocalSnapshot = {
  mangas: ReturnType<typeof readStoredMangas>;
  mediaEntries: ReturnType<typeof readMediaEntries>;
};

export type LocalCounts = {
  mangas: number;
  mediaEntries: number;
  total: number;
};

function safeRead<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    // Bozuk JSON ya da erişilemeyen depolama (ör. Safari gizli mod)
    return fallback;
  }
}

export function readLocalSnapshot(): LocalSnapshot {
  return {
    mangas: safeRead(readStoredMangas, null),
    mediaEntries: safeRead(readMediaEntries, null),
  };
}

export function countLocal(snapshot: LocalSnapshot): LocalCounts {
  const mangas = snapshot.mangas?.length ?? 0;
  const mediaEntries = snapshot.mediaEntries?.length ?? 0;

  return {
    mangas,
    mediaEntries,
    total: mangas + mediaEntries,
  };
}

export function isDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return true;
  }
}

export function dismiss(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // Yazılamazsa teklif tekrar gösterilir; veri kaybı olmaz
  }
}

/** Aktarım başarılıysa eski anahtarlar temizlenir — ikinci kez sorulmasın. */
function clearLocalKeys(): void {
  if (typeof window === "undefined") return;
  for (const key of [
    "bitig.mangas.v1",
    "bitig.media.entries.v1",
  ]) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Temizlenemezse teklif tekrar çıkabilir; veri zaten bulutta
    }
  }
}

export type ImportResult = {
  imported: LocalCounts;
  /** Bulutta zaten kayıt olduğu için atlanan modüller. */
  skipped: string[];
};

async function countRows(
  client: SupabaseClient,
  table: string,
  userId: string,
): Promise<number> {
  const { count, error } = await client
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Yerel kayıtları hesaba taşır.
 *
 * Bir modülde bulutta zaten kayıt varsa o modül ATLANIR: aktarım yinelenen
 * kayıt üretmemeli. Kimlikler yeniden üretilir; yereldeki id'ler slug tabanlıydı
 * ve tablolar uuid bekliyor.
 */
export async function importLocalData(
  client: SupabaseClient,
  userId: string,
  snapshot: LocalSnapshot,
): Promise<ImportResult> {
  const imported: LocalCounts = { mangas: 0, mediaEntries: 0, total: 0 };
  const skipped: string[] = [];

  const mangas = snapshot.mangas ?? [];
  if (mangas.length > 0) {
    if ((await countRows(client, "mangas", userId)) > 0) {
      skipped.push("Manga");
    } else {
      const { error } = await client
        .from("mangas")
        .insert(mangas.map((manga) => mangaToRow({ ...manga, id: createId() }, userId)));
      if (error) throw new Error(`Manga aktarılamadı: ${error.message}`);
      imported.mangas = mangas.length;
    }
  }

  const mediaEntries = snapshot.mediaEntries ?? [];
  if (mediaEntries.length > 0) {
    if ((await countRows(client, "media_entries", userId)) > 0) {
      skipped.push("Dizi / Film");
    } else {
      const { error } = await client
        .from("media_entries")
        .insert(
          mediaEntries.map((entry) => mediaEntryToRow({ ...entry, id: createId() }, userId)),
        );
      if (error) throw new Error(`Dizi/film kayıtları aktarılamadı: ${error.message}`);
      imported.mediaEntries = mediaEntries.length;
    }
  }


  // Atlanan modül varsa yerel veri silinmez: kullanıcı hangi kaydın nerede
  // olduğunu görebilsin, sessizce kaybolmasın.
  if (skipped.length === 0) clearLocalKeys();

  return { imported, skipped };
}
