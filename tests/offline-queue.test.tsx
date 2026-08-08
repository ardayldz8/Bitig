import { describe, expect, it, beforeEach } from "vitest";
import { bumpAttempts, dequeue, enqueue, listQueued, queueSize, MAX_DENEME } from "@/lib/offline/queue";
import "fake-indexeddb/auto";

/**
 * Kuyruk gerçek IndexedDB davranışıyla sınanıyor (fake-indexeddb, aynı API).
 * Amaç: sinyalsizken girilen kaydın gerçekten saklandığını ve bağlantı
 * gelince tam olarak bir kez gönderileceğini doğrulamak.
 */

const yazma = (id: string) => ({
  id,
  table: "food_entries",
  op: "insert" as const,
  payload: { name: "tost", calories: 300 },
});

beforeEach(async () => {
  for (const item of await listQueued()) await dequeue(item.id);
});

describe("çevrimdışı kuyruk", () => {
  it("kaydı saklar ve geri verir", async () => {
    await enqueue(yazma("a"));

    const bekleyenler = await listQueued();
    expect(bekleyenler).toHaveLength(1);
    expect(bekleyenler[0].table).toBe("food_entries");
    expect(bekleyenler[0].payload).toEqual({ name: "tost", calories: 300 });
    expect(bekleyenler[0].attempts).toBe(0);
  });

  it("eski kayıt önce gönderilir", async () => {
    /*
     * Sıra önemli: bir kaydın güncellemesi, oluşturulmasından sonra
     * uygulanmalı. Ters sırada gitse güncelleme var olmayan satırı arardı.
     */
    await enqueue(yazma("ilk"));
    await new Promise((r) => setTimeout(r, 5));
    await enqueue(yazma("ikinci"));

    const sirali = await listQueued();
    expect(sirali.map((item) => item.id)).toEqual(["ilk", "ikinci"]);
  });

  it("gönderilen kayıt kuyruktan çıkar", async () => {
    await enqueue(yazma("a"));
    await dequeue("a");
    expect(await queueSize()).toBe(0);
  });

  it("başarısız deneme sayacı artar", async () => {
    await enqueue(yazma("a"));
    const [item] = await listQueued();

    await bumpAttempts(item);

    const [sonra] = await listQueued();
    expect(sonra.attempts).toBe(1);
  });

  it("sürekli başarısız kayıt kuyruğu tıkamaz", async () => {
    /*
     * Kalıcı bir hata (ör. veri kısıtı ihlali) sonsuza kadar denenirse
     * arkasındaki kayıtlar da hiç gitmez. Deneme hakkı bitince düşürülüyor.
     */
    await enqueue(yazma("bozuk"));

    for (let i = 0; i < MAX_DENEME; i++) {
      const [item] = await listQueued();
      if (!item) break;
      await bumpAttempts(item);
    }

    expect(await queueSize()).toBe(0);
  });

  it("birden çok kayıt bağımsız saklanır", async () => {
    await enqueue(yazma("a"));
    await enqueue(yazma("b"));
    expect(await queueSize()).toBe(2);

    await dequeue("a");
    const kalan = await listQueued();
    expect(kalan.map((item) => item.id)).toEqual(["b"]);
  });
});
