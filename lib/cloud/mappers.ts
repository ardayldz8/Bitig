/**
 * Veritabanı satırı ↔ uygulama tipi dönüşümleri.
 *
 * Okuma tarafı savunmacı: satırdaki alan beklenen türde değilse kayıt atlanır
 * (null döner). Bozuk tek bir satır yüzünden tüm liste kaybolmasın diye çağıran
 * taraf null'ları eler.
 */

import type { FoodEntry, MealType, NutritionTargets } from "@/types/calorie";
import type { Manga, MangaStatus } from "@/types/manga";
import type { MediaEntry, MediaType, WatchStatus } from "@/types/media";
import type { FoodUnit, NutritionSource } from "@/types/nutrition";

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

// ---------------------------------------------------------------- Kalori

const MEAL_TYPES = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
] as const satisfies readonly MealType[];

const FOOD_UNITS = ["g", "ml", "piece", "portion"] as const satisfies readonly FoodUnit[];

export function rowToFoodEntry(row: Row): FoodEntry | null {
  const id = str(row, "id");
  const name = str(row, "name");
  const quantity = num(row, "quantity");
  const unit = oneOf(row, "unit", FOOD_UNITS);
  const mealType = oneOf(row, "meal_type", MEAL_TYPES);
  const consumedAt = str(row, "consumed_at");

  if (
    id === null ||
    name === null ||
    quantity === null ||
    unit === null ||
    mealType === null ||
    consumedAt === null
  ) {
    return null;
  }

  return {
    id,
    name,
    brand: str(row, "brand"),
    quantity,
    unit,
    calories: num(row, "calories") ?? 0,
    protein: num(row, "protein") ?? 0,
    carbohydrates: num(row, "carbohydrates") ?? 0,
    fat: num(row, "fat") ?? 0,
    mealType,
    // Kaynak alanı serbest bırakılır: yeni bir besin sağlayıcısı eklendiğinde
    // eski kayıtlar okunamaz hâle gelmesin.
    source: (str(row, "source") ?? "manual") as NutritionSource,
    sourceFoodId: str(row, "source_food_id"),
    originalCalories: num(row, "original_calories"),
    originalProtein: num(row, "original_protein"),
    originalCarbohydrates: num(row, "original_carbohydrates"),
    originalFat: num(row, "original_fat"),
    manuallyEdited: row.manually_edited === true,
    confidence: num(row, "confidence"),
    consumedAt,
    createdAt: str(row, "created_at") ?? consumedAt,
    updatedAt: str(row, "updated_at") ?? consumedAt,
  };
}

export function foodEntryToRow(entry: FoodEntry, userId: string): Row {
  return {
    id: entry.id,
    user_id: userId,
    name: entry.name,
    brand: entry.brand,
    quantity: entry.quantity,
    unit: entry.unit,
    calories: entry.calories,
    protein: entry.protein,
    carbohydrates: entry.carbohydrates,
    fat: entry.fat,
    meal_type: entry.mealType,
    source: entry.source,
    source_food_id: entry.sourceFoodId,
    original_calories: entry.originalCalories,
    original_protein: entry.originalProtein,
    original_carbohydrates: entry.originalCarbohydrates,
    original_fat: entry.originalFat,
    manually_edited: entry.manuallyEdited,
    confidence: entry.confidence,
    consumed_at: entry.consumedAt,
    created_at: entry.createdAt,
    updated_at: new Date().toISOString(),
  };
}

export function rowToTargets(row: Row): NutritionTargets | null {
  const calories = num(row, "calories");
  const protein = num(row, "protein");
  const carbohydrates = num(row, "carbohydrates");
  const fat = num(row, "fat");

  if (calories === null || protein === null || carbohydrates === null || fat === null) {
    return null;
  }

  return { calories, protein, carbohydrates, fat };
}

export function targetsToRow(targets: NutritionTargets, userId: string): Row {
  return {
    user_id: userId,
    calories: targets.calories,
    protein: targets.protein,
    carbohydrates: targets.carbohydrates,
    fat: targets.fat,
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
