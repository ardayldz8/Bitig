import { supabase } from "./supabase";
import type { Entry, Reminder, Goal, Routine, Profile, Dungeon, DungeonStep } from "./types";

/** Supabase satırını uygulama Entry'sine çevirir. */
function rowToEntry(r: Record<string, unknown>): Entry {
  const base = {
    id: String(r.id),
    createdAt: String(r.created_at),
    date: String(r.day),
    sourceText: (r.source_text as string) ?? undefined,
  };
  switch (r.kind) {
    case "habit":
      return {
        ...base,
        kind: "habit",
        name: String(r.name ?? ""),
        amount: r.amount == null ? undefined : Number(r.amount),
        unit: (r.unit as string) ?? undefined,
        done: Boolean(r.done),
      };
    case "task":
      return { ...base, kind: "task", title: String(r.title ?? ""), done: Boolean(r.done) };
    case "mood":
      return {
        ...base,
        kind: "mood",
        score: Number(r.score ?? 3),
        label: (r.label as string) ?? undefined,
        note: (r.note as string) ?? undefined,
      };
    case "food":
      return {
        ...base,
        kind: "food",
        name: String(r.name ?? ""),
        amount: r.amount == null ? undefined : Number(r.amount),
        unit: (r.unit as string) ?? undefined,
        kcal: Number(r.kcal ?? 0),
        protein: r.protein == null ? undefined : Number(r.protein),
        carb: r.carb == null ? undefined : Number(r.carb),
        fat: r.fat == null ? undefined : Number(r.fat),
      };
    default:
      return { ...base, kind: "journal", text: String(r.body ?? "") };
  }
}

/** Entry'yi DB satırına (insert için) çevirir. */
function entryToRow(e: Entry, userId: string): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: e.id,
    user_id: userId,
    kind: e.kind,
    day: e.date,
    created_at: e.createdAt,
    source_text: e.sourceText ?? null,
  };
  switch (e.kind) {
    case "habit":
      row.name = e.name;
      row.amount = e.amount ?? null;
      row.unit = e.unit ?? null;
      row.done = e.done;
      break;
    case "task":
      row.title = e.title;
      row.done = e.done;
      break;
    case "mood":
      row.score = e.score;
      row.label = e.label ?? null;
      row.note = e.note ?? null;
      break;
    case "journal":
      row.body = e.text;
      break;
    case "food":
      row.name = e.name;
      row.amount = e.amount ?? null;
      row.unit = e.unit ?? null;
      row.kcal = e.kcal;
      row.protein = e.protein ?? null;
      row.carb = e.carb ?? null;
      row.fat = e.fat ?? null;
      break;
  }
  return row;
}

export async function fetchEntries(): Promise<Entry[]> {
  const { data, error } = await supabase
    .from("entries")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToEntry);
}

export async function insertEntries(entries: Entry[], userId: string): Promise<void> {
  if (!entries.length) return;
  const { error } = await supabase.from("entries").insert(entries.map((e) => entryToRow(e, userId)));
  if (error) throw error;
}

export async function setDone(id: string, done: boolean): Promise<void> {
  const { error } = await supabase.from("entries").update({ done }).eq("id", id);
  if (error) throw error;
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase.from("entries").delete().eq("id", id);
  if (error) throw error;
}

/** Bir yemek kaydının yalnızca besin değerlerini günceller (web araştırması sonrası). */
export async function updateFoodNutrition(
  id: string,
  n: { kcal?: number; protein?: number; carb?: number; fat?: number }
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (n.kcal != null) row.kcal = n.kcal;
  if (n.protein != null) row.protein = n.protein;
  if (n.carb != null) row.carb = n.carb;
  if (n.fat != null) row.fat = n.fat;
  if (!Object.keys(row).length) return;
  const { error } = await supabase.from("entries").update(row).eq("id", id);
  if (error) throw error;
}

/** Bir kaydı yerinde günceller (tür + içerik değişebilir). id/created_at korunur. */
export async function updateEntryContent(id: string, e: Entry): Promise<void> {
  const row: Record<string, unknown> = {
    kind: e.kind,
    day: e.date,
    // tüm içerik kolonlarını sıfırla, sonra yeni türünkileri doldur
    name: null,
    amount: null,
    unit: null,
    done: null,
    title: null,
    score: null,
    label: null,
    note: null,
    body: null,
    kcal: null,
    protein: null,
    carb: null,
    fat: null,
  };
  switch (e.kind) {
    case "habit":
      row.name = e.name;
      row.amount = e.amount ?? null;
      row.unit = e.unit ?? null;
      row.done = e.done;
      break;
    case "task":
      row.title = e.title;
      row.done = e.done;
      break;
    case "mood":
      row.score = e.score;
      row.label = e.label ?? null;
      row.note = e.note ?? null;
      break;
    case "journal":
      row.body = e.text;
      break;
    case "food":
      row.name = e.name;
      row.amount = e.amount ?? null;
      row.unit = e.unit ?? null;
      row.kcal = e.kcal;
      row.protein = e.protein ?? null;
      row.carb = e.carb ?? null;
      row.fat = e.fat ?? null;
      break;
  }
  const { error } = await supabase.from("entries").update(row).eq("id", id);
  if (error) throw error;
}

// --- Hatırlatmalar ---

export async function insertReminder(
  r: { id: string; text: string; remind_at: string; repeat?: string | null },
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from("reminders")
    .insert({
      id: r.id,
      user_id: userId,
      text: r.text,
      remind_at: r.remind_at,
      repeat: r.repeat ?? null,
    });
  if (error) throw error;
}

/** Henüz gönderilmemiş hatırlatmalar (zamana göre artan). */
export async function fetchReminders(): Promise<Reminder[]> {
  const { data, error } = await supabase
    .from("reminders")
    .select("id,text,remind_at,sent,repeat")
    .eq("sent", false)
    .order("remind_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Reminder[];
}

export async function deleteReminder(id: string): Promise<void> {
  const { error } = await supabase.from("reminders").delete().eq("id", id);
  if (error) throw error;
}

// --- Hedefler ---

export async function insertGoal(g: Goal, userId: string): Promise<void> {
  const { error } = await supabase.from("goals").insert({
    id: g.id,
    user_id: userId,
    title: g.title,
    habit: g.habit,
    target: g.target,
    period: g.period,
    metric: g.metric,
    unit: g.unit ?? null,
  });
  if (error) throw error;
}

export async function fetchGoals(): Promise<Goal[]> {
  const { data, error } = await supabase
    .from("goals")
    .select("id,title,habit,target,period,metric,unit")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Goal[];
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) throw error;
}

// --- Rutinler (sabit günlük alışkanlıklar) ---

export async function fetchRoutines(): Promise<Routine[]> {
  const { data, error } = await supabase
    .from("routines")
    .select("id,name,emoji")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Routine[];
}

export async function insertRoutine(r: Routine, userId: string): Promise<void> {
  const { error } = await supabase
    .from("routines")
    .insert({ id: r.id, user_id: userId, name: r.name, emoji: r.emoji ?? null });
  if (error) throw error;
}

export async function deleteRoutine(id: string): Promise<void> {
  const { error } = await supabase.from("routines").delete().eq("id", id);
  if (error) throw error;
}

// --- Profil ---

export async function fetchProfile(): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("height_cm,weight_kg,age,sex,activity,goal")
    .maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

export async function upsertProfile(p: Profile, userId: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .upsert({ user_id: userId, ...p, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}

// --- Zindanlar (dungeon) ---

function rowToDungeon(r: Record<string, unknown>): Dungeon {
  return {
    id: String(r.id),
    name: String(r.name ?? ""),
    rank: String(r.rank ?? "E"),
    boss: (r.boss as string) ?? undefined,
    steps: Array.isArray(r.steps) ? (r.steps as DungeonStep[]) : [],
    completedAt: (r.completed_at as string) ?? null,
  };
}

export async function fetchDungeons(): Promise<Dungeon[]> {
  const { data, error } = await supabase
    .from("dungeons")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToDungeon);
}

export async function insertDungeon(d: Dungeon, userId: string): Promise<void> {
  const { error } = await supabase.from("dungeons").insert({
    id: d.id,
    user_id: userId,
    name: d.name,
    rank: d.rank,
    boss: d.boss ?? null,
    steps: d.steps,
    completed_at: d.completedAt ?? null,
  });
  if (error) throw error;
}

export async function updateDungeon(
  id: string,
  patch: { steps?: DungeonStep[]; completedAt?: string | null }
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.steps) row.steps = patch.steps;
  if (patch.completedAt !== undefined) row.completed_at = patch.completedAt;
  const { error } = await supabase.from("dungeons").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteDungeon(id: string): Promise<void> {
  const { error } = await supabase.from("dungeons").delete().eq("id", id);
  if (error) throw error;
}

// --- Sohbet mesajları (cihazlar arası senkron + analiz) ---

export async function fetchChatMessages(): Promise<
  { role: "user" | "assistant"; text: string; note?: string }[]
> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("role,text,note")
    .order("created_at", { ascending: true })
    .limit(300);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    role: (r.role as "user" | "assistant") ?? "assistant",
    text: String(r.text ?? ""),
    note: (r.note as string) ?? undefined,
  }));
}

export async function insertChatMessages(
  msgs: { role: "user" | "assistant"; text: string; note?: string }[],
  userId: string
): Promise<void> {
  if (!msgs.length) return;
  const { error } = await supabase
    .from("chat_messages")
    .insert(msgs.map((m) => ({ user_id: userId, role: m.role, text: m.text, note: m.note ?? null })));
  if (error) throw error;
}

export async function clearChatMessages(userId: string): Promise<void> {
  const { error } = await supabase.from("chat_messages").delete().eq("user_id", userId);
  if (error) throw error;
}
