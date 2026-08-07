"use client";

import { useCallback, useMemo } from "react";
import { useCloudCollection } from "@/hooks/use-cloud-collection";
import {
  noteToRow,
  reminderToRow,
  rowToNote,
  rowToReminder,
} from "@/lib/cloud/mappers";
import { createId } from "@/lib/ids";
import type { Note, NoteDraft, Reminder, ReminderDraft } from "@/types/notes";

/**
 * Sunucuya yazmadan yalnızca ekranı güncelleyen persist.
 *
 * `mutate` her zaman bir PostgREST yanıtı bekliyor; null dönmek çağrı
 * zincirinde `{ error }` destructure edilirken patlıyor.
 */
const SADECE_YEREL = () => Promise.resolve({ error: null });

export type NotesLibrary = {
  notes: Note[];
  /** Not id → o notun hatırlatmaları. */
  remindersByNote: Map<string, Reminder[]>;
  hydrated: boolean;
  error: string | null;

  addNote: (draft: NoteDraft) => string;
  updateNote: (id: string, draft: NoteDraft) => void;
  removeNote: (id: string) => void;
  togglePin: (id: string) => void;

  addReminder: (noteId: string, draft: ReminderDraft) => void;
  updateReminder: (id: string, draft: ReminderDraft) => void;
  toggleReminder: (id: string) => void;
  removeReminder: (id: string) => void;
};

/** Tarayıcının saat dilimi; hatırlatma o dilime göre tetiklenir. */
function yerelDilim(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Istanbul";
  } catch {
    return "Europe/Istanbul";
  }
}

export function useNotes(): NotesLibrary {
  const noteCollection = useCloudCollection<Note>({
    table: "notes",
    orderColumn: "updated_at",
    ascending: false,
    toItem: rowToNote,
  });

  /*
   * Hatırlatmalar ayrı koleksiyon: notes tablosuyla birlikte join'lemek
   * yerine iki liste çekip bellekte eşleştiriyoruz. Böylece mevcut
   * useCloudCollection makinesi (iyimser güncelleme, hata geri alma) her iki
   * taraf için de olduğu gibi çalışıyor.
   */
  const reminderCollection = useCloudCollection<Reminder>({
    table: "note_reminders",
    orderColumn: "time_of_day",
    ascending: true,
    toItem: rowToReminder,
  });

  const { mutate: mutateNotes } = noteCollection;
  const { mutate: mutateReminders } = reminderCollection;

  const remindersByNote = useMemo(() => {
    const map = new Map<string, Reminder[]>();
    for (const reminder of reminderCollection.items) {
      const list = map.get(reminder.noteId) ?? [];
      list.push(reminder);
      map.set(reminder.noteId, list);
    }
    return map;
  }, [reminderCollection.items]);

  const addNote = useCallback(
    (draft: NoteDraft) => {
      const note: Note = {
        id: createId(),
        title: draft.title,
        body: draft.body,
        pinned: false,
        updatedAt: new Date().toISOString(),
      };
      mutateNotes(
        (previous) => [note, ...previous],
        (client, userId) => client.from("notes").insert(noteToRow(note, userId)),
        "Not eklenemedi",
      );
      // Çağıran taraf yeni notun hatırlatmasını ekleyebilsin diye id dönüyor
      return note.id;
    },
    [mutateNotes],
  );

  const updateNote = useCallback(
    (id: string, draft: NoteDraft) => {
      mutateNotes(
        (previous) =>
          previous.map((note) =>
            note.id === id
              ? { ...note, ...draft, updatedAt: new Date().toISOString() }
              : note,
          ),
        (client, userId) =>
          client
            .from("notes")
            .update({
              title: draft.title,
              body: draft.body,
              updated_at: new Date().toISOString(),
              user_id: userId,
            })
            .eq("id", id),
        "Not güncellenemedi",
      );
    },
    [mutateNotes],
  );

  const removeNote = useCallback(
    (id: string) => {
      // Hatırlatmalar veritabanında `on delete cascade` ile gidiyor; yerel
      // listeden de düşürülmeli, yoksa silinen notun saatleri ekranda kalır.
      mutateReminders(
        (previous) => previous.filter((reminder) => reminder.noteId !== id),
        SADECE_YEREL,
        "",
      );
      mutateNotes(
        (previous) => previous.filter((note) => note.id !== id),
        (client) => client.from("notes").delete().eq("id", id),
        "Not silinemedi",
      );
    },
    [mutateNotes, mutateReminders],
  );

  const togglePin = useCallback(
    (id: string) => {
      mutateNotes(
        (previous) =>
          previous.map((note) =>
            note.id === id ? { ...note, pinned: !note.pinned } : note,
          ),
        (client, userId, next) => {
          const note = next.find((item) => item.id === id);
          if (!note) return SADECE_YEREL();
          return client.from("notes").update(noteToRow(note, userId)).eq("id", id);
        },
        "Sabitleme değiştirilemedi",
      );
    },
    [mutateNotes],
  );

  const addReminder = useCallback(
    (noteId: string, draft: ReminderDraft) => {
      const reminder: Reminder = {
        id: createId(),
        noteId,
        time: draft.time,
        days: draft.days,
        enabled: true,
        timezone: yerelDilim(),
      };
      mutateReminders(
        (previous) => [...previous, reminder],
        (client, userId) =>
          client.from("note_reminders").insert(reminderToRow(reminder, userId)),
        "Hatırlatma eklenemedi",
      );
    },
    [mutateReminders],
  );

  const updateReminder = useCallback(
    (id: string, draft: ReminderDraft) => {
      mutateReminders(
        (previous) =>
          previous.map((reminder) =>
            reminder.id === id ? { ...reminder, ...draft } : reminder,
          ),
        (client) =>
          client
            .from("note_reminders")
            .update({ time_of_day: draft.time, days_of_week: draft.days })
            .eq("id", id),
        "Hatırlatma güncellenemedi",
      );
    },
    [mutateReminders],
  );

  const toggleReminder = useCallback(
    (id: string) => {
      mutateReminders(
        (previous) =>
          previous.map((reminder) =>
            reminder.id === id ? { ...reminder, enabled: !reminder.enabled } : reminder,
          ),
        (client, _userId, next) => {
          const reminder = next.find((item) => item.id === id);
          if (!reminder) return SADECE_YEREL();
          return client
            .from("note_reminders")
            .update({ enabled: reminder.enabled })
            .eq("id", id);
        },
        "Hatırlatma değiştirilemedi",
      );
    },
    [mutateReminders],
  );

  const removeReminder = useCallback(
    (id: string) => {
      mutateReminders(
        (previous) => previous.filter((reminder) => reminder.id !== id),
        (client) => client.from("note_reminders").delete().eq("id", id),
        "Hatırlatma silinemedi",
      );
    },
    [mutateReminders],
  );

  /** Sabitlenenler üstte; içlerinde en son güncellenen önce. */
  const notes = useMemo(() => {
    return [...noteCollection.items].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [noteCollection.items]);

  return {
    notes,
    remindersByNote,
    hydrated: noteCollection.hydrated && reminderCollection.hydrated,
    error: noteCollection.error ?? reminderCollection.error,
    addNote,
    updateNote,
    removeNote,
    togglePin,
    addReminder,
    updateReminder,
    toggleReminder,
    removeReminder,
  };
}
