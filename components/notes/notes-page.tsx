"use client";

import { useState } from "react";
import { Bell, Pencil, Pin, PinOff, Plus, Trash2, X } from "lucide-react";
import NotificationBanner from "@/components/notes/notification-banner";
import ReminderEditor from "@/components/notes/reminder-editor";
import { useNotes } from "@/hooks/use-notes";
import { tekrarMetni, type Note } from "@/types/notes";

/** Düzenlenmekte olan not: yeni ise id yok. */
type Taslak = { id: string | null; title: string; body: string };

const BOS_TASLAK: Taslak = { id: null, title: "", body: "" };

export default function NotesPage({ vapidPublicKey }: { vapidPublicKey: string }) {
  const library = useNotes();
  const [taslak, setTaslak] = useState<Taslak | null>(null);
  const [arama, setArama] = useState("");

  const {
    notes,
    remindersByNote,
    hydrated,
    error,
    addNote,
    updateNote,
    removeNote,
    togglePin,
    addReminder,
    toggleReminder,
    removeReminder,
  } = library;

  const gorunen = arama.trim()
    ? notes.filter((note) =>
        `${note.title} ${note.body}`.toLocaleLowerCase("tr").includes(
          arama.trim().toLocaleLowerCase("tr"),
        ),
      )
    : notes;

  const kaydet = () => {
    if (!taslak) return;
    const title = taslak.title.trim();
    const body = taslak.body.trim();
    // Veritabanı kısıtı ikisinin birden boş olmasını reddediyor
    if (!title && !body) {
      setTaslak(null);
      return;
    }

    if (taslak.id) {
      updateNote(taslak.id, { title, body });
      setTaslak(null);
    } else {
      const id = addNote({ title, body });
      // Kaydettikten sonra kapatmıyoruz: kullanıcı genelde hemen saat ekliyor
      setTaslak({ id, title, body });
    }
  };

  return (
    <main className="mx-auto max-w-[1100px] px-4 pb-12 pt-6 sm:px-6 sm:pb-12">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold text-ink">Notlar</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Aklında kalsın istediklerini yaz, istediğin saatlerde kendine hatırlat.
        </p>
      </header>

      <div className="mb-5">
        <NotificationBanner vapidPublicKey={vapidPublicKey} />
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-line bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mb-5 flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          value={arama}
          onChange={(event) => setArama(event.target.value)}
          placeholder="Notlarda ara…"
          aria-label="Notlarda ara"
          className="min-h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-ink"
        />
        <button
          type="button"
          onClick={() => setTaslak(BOS_TASLAK)}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-strong"
        >
          <Plus size={16} aria-hidden="true" />
          Yeni not
        </button>
      </div>

      {!hydrated && <p className="text-sm text-ink-soft">Yükleniyor…</p>}

      {hydrated && gorunen.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line-strong px-4 py-10 text-center text-sm text-ink-soft">
          {arama.trim() ? "Aramaya uyan not yok." : "Henüz not yok. İlkini ekle."}
        </p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {gorunen.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            reminderCount={remindersByNote.get(note.id)?.length ?? 0}
            reminderSummary={remindersByNote.get(note.id) ?? []}
            onEdit={() => setTaslak({ id: note.id, title: note.title, body: note.body })}
            onPin={() => togglePin(note.id)}
            onRemove={() => removeNote(note.id)}
          />
        ))}
      </ul>

      {taslak && (
        <NoteDialog
          taslak={taslak}
          reminders={taslak.id ? (remindersByNote.get(taslak.id) ?? []) : []}
          onChange={setTaslak}
          onSave={kaydet}
          onClose={() => setTaslak(null)}
          onAddReminder={(time, days) => {
            if (taslak.id) addReminder(taslak.id, { time, days });
          }}
          onToggleReminder={toggleReminder}
          onRemoveReminder={removeReminder}
        />
      )}
    </main>
  );
}

function NoteCard({
  note,
  reminderCount,
  reminderSummary,
  onEdit,
  onPin,
  onRemove,
}: {
  note: Note;
  reminderCount: number;
  reminderSummary: { time: string; days: number[]; enabled: boolean }[];
  onEdit: () => void;
  onPin: () => void;
  onRemove: () => void;
}) {
  const acikOlanlar = reminderSummary.filter((item) => item.enabled);

  return (
    <li className="flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-2">
        <h2 className="min-w-0 flex-1 break-words text-base font-semibold text-ink">
          {note.title || "Başlıksız"}
        </h2>
        <button
          type="button"
          onClick={onPin}
          aria-label={note.pinned ? "Sabitlemeyi kaldır" : "Sabitle"}
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors ${
            note.pinned ? "bg-brand-soft text-brand" : "text-ink-soft hover:text-brand"
          }`}
        >
          {note.pinned ? <Pin size={16} /> : <PinOff size={16} />}
        </button>
      </div>

      {note.body && (
        // Uzun not kartı şişirmesin; tamamı düzenleme ekranında görünüyor
        <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap break-words text-sm text-ink-soft">
          {note.body}
        </p>
      )}

      {reminderCount > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {acikOlanlar.slice(0, 3).map((reminder, index) => (
            <span
              key={`${reminder.time}-${index}`}
              className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand"
            >
              <Bell size={12} aria-hidden="true" />
              <span className="tabular-nums">{reminder.time}</span>
              <span className="text-brand/70">· {tekrarMetni(reminder.days)}</span>
            </span>
          ))}
          {acikOlanlar.length > 3 && (
            <span className="inline-flex items-center rounded-full bg-canvas px-2.5 py-1 text-xs text-ink-soft">
              +{acikOlanlar.length - 3}
            </span>
          )}
          {acikOlanlar.length === 0 && (
            <span className="inline-flex items-center rounded-full bg-canvas px-2.5 py-1 text-xs text-ink-soft">
              {reminderCount} hatırlatma duraklatıldı
            </span>
          )}
        </div>
      )}

      <div className="mt-4 flex gap-2 border-t border-line pt-3">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-line text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand"
        >
          <Pencil size={15} aria-hidden="true" />
          Düzenle
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Notu sil"
          className="grid min-h-11 w-11 place-items-center rounded-xl border border-line text-ink-soft transition-colors hover:border-danger hover:text-danger"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </li>
  );
}

function NoteDialog({
  taslak,
  reminders,
  onChange,
  onSave,
  onClose,
  onAddReminder,
  onToggleReminder,
  onRemoveReminder,
}: {
  taslak: Taslak;
  reminders: { id: string; time: string; days: number[]; enabled: boolean }[];
  onChange: (taslak: Taslak) => void;
  onSave: () => void;
  onClose: () => void;
  onAddReminder: (time: string, days: number[]) => void;
  onToggleReminder: (id: string) => void;
  onRemoveReminder: (id: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={taslak.id ? "Notu düzenle" : "Yeni not"}
    >
      {/* Dar ekranda alttan açılan sayfa; klavye açılınca içerik kaydırılabilir */}
      <div className="max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-t-2xl bg-surface p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="min-w-0 flex-1 text-lg font-semibold text-ink">
            {taslak.id ? "Notu düzenle" : "Yeni not"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="grid h-11 w-11 place-items-center rounded-xl text-ink-soft transition-colors hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <input
            value={taslak.title}
            onChange={(event) => onChange({ ...taslak, title: event.target.value })}
            placeholder="Başlık"
            aria-label="Başlık"
            className="min-h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-ink"
          />
          <textarea
            value={taslak.body}
            onChange={(event) => onChange({ ...taslak, body: event.target.value })}
            placeholder="Not…"
            aria-label="Not içeriği"
            rows={6}
            className="w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-ink"
          />
        </div>

        <div className="mt-5 border-t border-line pt-4">
          {taslak.id ? (
            <ReminderEditor
              reminders={reminders.map((item) => ({
                ...item,
                noteId: taslak.id!,
                timezone: "",
              }))}
              onAdd={onAddReminder}
              onToggle={onToggleReminder}
              onRemove={onRemoveReminder}
            />
          ) : (
            // Hatırlatma bir nota bağlı; not kaydedilmeden bağlanacağı id yok
            <p className="text-sm text-ink-soft">
              Notu kaydettikten sonra hatırlatma saati ekleyebilirsin.
            </p>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onSave}
            className="min-h-11 flex-1 rounded-xl bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-strong"
          >
            {taslak.id ? "Kaydet" : "Oluştur"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl border border-line px-4 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand"
          >
            {taslak.id ? "Kapat" : "Vazgeç"}
          </button>
        </div>
      </div>
    </div>
  );
}
