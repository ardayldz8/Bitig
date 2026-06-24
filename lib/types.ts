export type EntryKind = "habit" | "task" | "mood" | "journal" | "food";

export interface BaseEntry {
  id: string;
  createdAt: string; // ISO timestamp
  date: string; // YYYY-MM-DD (yerel gün)
  sourceText?: string; // kaydın geldiği orijinal cümle (varsa)
}

export interface HabitEntry extends BaseEntry {
  kind: "habit";
  name: string; // "koşu", "su", "okuma"
  amount?: number; // 45
  unit?: string; // "dk", "bardak", "sayfa"
  done: boolean;
}

export interface TaskEntry extends BaseEntry {
  kind: "task";
  title: string;
  done: boolean;
}

export interface MoodEntry extends BaseEntry {
  kind: "mood";
  score: number; // 1-5
  label?: string; // "dağınık", "enerjik"
  note?: string;
}

export interface JournalEntry extends BaseEntry {
  kind: "journal";
  text: string;
}

export interface FoodEntry extends BaseEntry {
  kind: "food";
  name: string;
  amount?: number;
  unit?: string;
  kcal: number;
  protein?: number;
  carb?: number;
  fat?: number;
}

export type Entry = HabitEntry | TaskEntry | MoodEntry | JournalEntry | FoodEntry;

/**
 * Yapay zeka veya yedek ayrıştırıcının döndürdüğü ham öğe.
 * id/tarih gibi alanlar istemci tarafında eklenir.
 */
export type ParsedItem =
  | { kind: "habit"; name: string; amount?: number; unit?: string; done?: boolean }
  | { kind: "task"; title: string; done?: boolean }
  | { kind: "mood"; score: number; label?: string; note?: string }
  | { kind: "journal"; text: string }
  | {
      kind: "food";
      name: string;
      amount?: number;
      unit?: string;
      kcal: number;
      protein?: number;
      carb?: number;
      fat?: number;
    };

export interface ParseResponse {
  items: ParsedItem[];
  source: "ai" | "fallback";
}

/** Sohbet asistanının uygulayacağı işlemler. */
export type ChatAction =
  | { type: "add"; item: ParsedItem; date?: string }
  | { type: "complete"; id: string; done: boolean }
  | { type: "delete"; id: string }
  | { type: "edit"; id: string; item: ParsedItem } // o kaydı yeni içerikle değiştirir (tür değişebilir)
  | { type: "reminder"; text: string; at: string; repeat?: "daily" | "weekly" } // at: yerel "YYYY-MM-DDTHH:mm:ss"
  | { type: "reminderDelete"; id: string } // mevcut hatırlatmayı iptal et
  | {
      type: "food";
      name: string;
      amount?: number;
      unit?: string;
      kcal: number;
      protein?: number;
      carb?: number;
      fat?: number;
    }
  | {
      type: "goal";
      title: string;
      habit: string;
      target: number;
      period: "day" | "week";
      metric?: "count" | "amount";
      unit?: string;
    }
  | { type: "dungeon"; name: string; rank?: string; boss?: string; steps: string[] };

export interface Reminder {
  id: string;
  text: string;
  remind_at: string; // ISO (UTC)
  sent: boolean;
  repeat?: string | null; // null = tek sefer · "daily" · "weekly"
}

/** Günlük quest (Solo Leveling "System"). */
export type QuestStat = "STR" | "INT" | "VIT" | "DEX";

export interface QuestSpec {
  text: string;
  stat: QuestStat;
  item: ParsedItem; // tamamlanınca kaydedilecek
}

export interface Quest extends QuestSpec {
  id: string;
  done: boolean;
  entryId?: string; // tamamlanınca oluşan kaydın id'si (geri alma için)
}

/** Kullanıcı profili — günlük kalori/makro hedefi hesabı için. */
export interface Profile {
  height_cm?: number;
  weight_kg?: number;
  age?: number;
  sex?: "male" | "female";
  activity?: "sedentary" | "light" | "moderate" | "active" | "very";
  goal?: "lose" | "maintain" | "gain";
}

/** Sabit/tekrarlayan günlük alışkanlık tanımı (her gün checklist'te çıkar). */
export interface Routine {
  id: string;
  name: string;
  emoji?: string;
}

/** Solo Leveling "zindan" — çok adımlı meydan okuma. */
export interface DungeonStep {
  id: string;
  text: string;
  done: boolean;
}

export interface Dungeon {
  id: string;
  name: string;
  rank: string; // E..S
  boss?: string;
  steps: DungeonStep[];
  completedAt?: string | null;
}

/** Hedef (ör. "haftada 3 spor", "günde 2L su"). */
export interface Goal {
  id: string;
  title: string;
  habit: string; // eşleştirilecek alışkanlık adı
  target: number;
  period: "day" | "week";
  metric: "count" | "amount";
  unit?: string;
}

/** Geçmiş filtreleme için AI'nın ürettiği akıllı çip/facet. */
export interface Facet {
  label: string;
  emoji?: string;
  kinds?: string[]; // eşleşen kayıt türleri (habit/task/mood/journal/food)
  keywords?: string[]; // metinde aranan küçük harfli kökler
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export interface ChatResponse {
  reply: string;
  actions: ChatAction[];
}
