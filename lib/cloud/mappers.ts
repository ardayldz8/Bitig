/**
 * Veritabanı satırı ↔ uygulama tipi dönüşümleri.
 *
 * Okuma tarafı savunmacı: satırdaki alan beklenen türde değilse kayıt atlanır
 * (null döner). Bozuk tek bir satır yüzünden tüm liste kaybolmasın diye çağıran
 * taraf null'ları eler.
 */

import type { Manga, MangaStatus } from "@/types/manga";
import type { MediaEntry, MediaType, WatchStatus } from "@/types/media";
import type { Note, Reminder } from "@/types/notes";

export type Row = Record<string, unknown>;

function str(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === "string" ? value : null;
}

function num(row: Row, key: string): number | null {
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  // Postgres `numeric` PostgREST üzerinden string gelebilir
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function oneOf<T extends string>(row: Row, key: string, allowed: readonly T[]): T | null {
  const value = row[key];
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

// ---------------------------------------------------------------- Manga

const MANGA_STATUSES = ["reading", "completed"] as const satisfies readonly MangaStatus[];

export function rowToManga(row: Row): Manga | null {
  const id = str(row, "id");
  const name = str(row, "name");
  const currentChapter = num(row, "current_chapter");
  const rating = num(row, "rating");
  const status = oneOf(row, "status", MANGA_STATUSES);

  if (id === null || name === null || currentChapter === null || status === null) {
    return null;
  }

  return {
    id,
    name,
    currentChapter,
    rating: rating ?? 0,
    status,
    coverUrl: str(row, "cover_url"),
    mangadexId: str(row, "mangadex_id"),
    latestChapter: num(row, "latest_chapter"),
  };
}

export function mangaToRow(manga: Manga, userId: string): Row {
  return {
    id: manga.id,
    user_id: userId,
    name: manga.name,
    current_chapter: manga.currentChapter,
    rating: manga.rating,
    status: manga.status,
    cover_url: manga.coverUrl,
    updated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------- Dizi / Film

const MEDIA_TYPES = ["series", "movie"] as const satisfies readonly MediaType[];
const WATCH_STATUSES = [
  "watching",
  "completed",
  "planned",
] as const satisfies readonly WatchStatus[];

export function rowToMediaEntry(row: Row): MediaEntry | null {
  const id = str(row, "id");
  const title = str(row, "title");
  const mediaType = oneOf(row, "media_type", MEDIA_TYPES);
  const status = oneOf(row, "status", WATCH_STATUSES);

  if (id === null || title === null || mediaType === null || status === null) return null;

  const createdAt = str(row, "created_at") ?? new Date(0).toISOString();

  return {
    id,
    title,
    mediaType,
    currentSeason: num(row, "current_season"),
    currentEpisode: num(row, "current_episode"),
    totalSeasons: num(row, "total_seasons"),
    totalEpisodes: num(row, "total_episodes"),
    watchedEpisodes: num(row, "watched_episodes"),
    rating: num(row, "rating"),
    status,
    posterUrl: str(row, "poster_url"),
    releaseYear: num(row, "release_year"),
    createdAt,
    updatedAt: str(row, "updated_at") ?? createdAt,
  };
}

export function mediaEntryToRow(entry: MediaEntry, userId: string): Row {
  return {
    id: entry.id,
    user_id: userId,
    title: entry.title,
    media_type: entry.mediaType,
    current_season: entry.currentSeason,
    current_episode: entry.currentEpisode,
    total_seasons: entry.totalSeasons,
    total_episodes: entry.totalEpisodes,
    watched_episodes: entry.watchedEpisodes,
    rating: entry.rating,
    status: entry.status,
    poster_url: entry.posterUrl,
    release_year: entry.releaseYear,
    created_at: entry.createdAt,
    updated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------- Notlar

export function rowToNote(row: Row): Note | null {
  const id = str(row, "id");
  if (id === null) return null;

  return {
    id,
    title: str(row, "title") ?? "",
    body: str(row, "body") ?? "",
    pinned: row.pinned === true,
    updatedAt: str(row, "updated_at") ?? "",
  };
}

export function noteToRow(note: Note, userId: string): Row {
  return {
    id: note.id,
    user_id: userId,
    title: note.title,
    body: note.body,
    pinned: note.pinned,
    updated_at: new Date().toISOString(),
  };
}

/** Postgres `time` alanı "08:30:00" gelir; arayüz "08:30" kullanıyor. */
function saatiKisalt(value: string): string {
  const match = value.match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : value;
}

export function rowToReminder(row: Row): Reminder | null {
  const id = str(row, "id");
  const noteId = str(row, "note_id");
  const time = str(row, "time_of_day");
  if (id === null || noteId === null || time === null) return null;

  const rawDays = row.days_of_week;
  const days = Array.isArray(rawDays)
    ? rawDays.filter((day): day is number => typeof day === "number" && day >= 1 && day <= 7)
    : [];

  return {
    id,
    noteId,
    time: saatiKisalt(time),
    days,
    enabled: row.enabled !== false,
    timezone: str(row, "timezone") ?? "Europe/Istanbul",
  };
}

export function reminderToRow(reminder: Reminder, userId: string): Row {
  return {
    id: reminder.id,
    user_id: userId,
    note_id: reminder.noteId,
    time_of_day: reminder.time,
    days_of_week: reminder.days,
    enabled: reminder.enabled,
    timezone: reminder.timezone,
  };
}
