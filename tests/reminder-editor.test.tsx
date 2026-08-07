import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReminderEditor from "@/components/notes/reminder-editor";
import type { Reminder } from "@/types/notes";

const hatirlatma = (over: Partial<Reminder> = {}): Reminder => ({
  id: "r1",
  noteId: "n1",
  time: "08:30",
  days: [],
  enabled: true,
  timezone: "Europe/Istanbul",
  ...over,
});

function kur(props: Partial<Parameters<typeof ReminderEditor>[0]> = {}) {
  const onAdd = vi.fn();
  const onToggle = vi.fn();
  const onRemove = vi.fn();
  render(
    <ReminderEditor
      reminders={[]}
      onAdd={onAdd}
      onToggle={onToggle}
      onRemove={onRemove}
      {...props}
    />,
  );
  return { onAdd, onToggle, onRemove };
}

describe("hatırlatma düzenleyici", () => {
  it("saat ekleyince seçilen günlerle bildirir", async () => {
    const user = userEvent.setup();
    const { onAdd } = kur();

    await user.click(screen.getByRole("button", { name: "Pzt" }));
    await user.click(screen.getByRole("button", { name: "Cum" }));
    await user.click(screen.getByRole("button", { name: /saat ekle/i }));

    expect(onAdd).toHaveBeenCalledWith("09:00", [1, 5]);
  });

  it("gün seçilmezse boş dizi gönderir — her gün demek", async () => {
    const user = userEvent.setup();
    const { onAdd } = kur();

    await user.click(screen.getByRole("button", { name: /saat ekle/i }));

    expect(onAdd).toHaveBeenCalledWith("09:00", []);
  });

  it("art arda saat eklerken gün seçimi korunur", async () => {
    // Sabah/öğle/akşam eklerken aynı günleri tekrar seçtirmek gereksiz
    const user = userEvent.setup();
    const { onAdd } = kur();

    await user.click(screen.getByRole("button", { name: "Cmt" }));
    await user.click(screen.getByRole("button", { name: /saat ekle/i }));
    await user.click(screen.getByRole("button", { name: /saat ekle/i }));

    expect(onAdd).toHaveBeenNthCalledWith(1, "09:00", [6]);
    expect(onAdd).toHaveBeenNthCalledWith(2, "09:00", [6]);
  });

  it("aynı güne tekrar basmak seçimi kaldırır", async () => {
    const user = userEvent.setup();
    const { onAdd } = kur();

    await user.click(screen.getByRole("button", { name: "Sal" }));
    await user.click(screen.getByRole("button", { name: "Sal" }));
    await user.click(screen.getByRole("button", { name: /saat ekle/i }));

    expect(onAdd).toHaveBeenCalledWith("09:00", []);
  });

  it("duraklatılmış hatırlatma üstü çizili gösterilir", () => {
    kur({ reminders: [hatirlatma({ enabled: false })] });

    expect(screen.getByText("08:30")).toHaveClass("line-through");
    expect(screen.getByRole("button", { name: /hatırlatmayı aç/i })).toBeInTheDocument();
  });

  it("açık hatırlatma duraklatılabilir", async () => {
    const user = userEvent.setup();
    const { onToggle } = kur({ reminders: [hatirlatma()] });

    await user.click(screen.getByRole("button", { name: /hatırlatmayı duraklat/i }));

    expect(onToggle).toHaveBeenCalledWith("r1");
  });

  it("tekrar metni gün seçimini insan diline çevirir", () => {
    kur({ reminders: [hatirlatma({ days: [1, 2, 3, 4, 5] })] });
    expect(screen.getByText("Hafta içi")).toBeInTheDocument();
  });
});
