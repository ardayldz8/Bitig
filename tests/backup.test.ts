import { describe, expect, it } from "vitest";
import { parseBackup, tekduzeleştir } from "@/lib/backup/import";

describe("yedek dosyası doğrulama", () => {
  it("geçerli dosyayı okur ve özetler", () => {
    const sonuc = parseBackup(
      JSON.stringify({
        version: 1,
        exportedAt: "2026-08-07T10:00:00.000Z",
        account: { userId: "u1", email: "a@b.c" },
        tables: {
          mangas: [{ id: "1" }, { id: "2" }],
          projects: [{ id: "p1" }],
          github_commits: [{ id: "c1" }],
        },
      }),
    );

    expect(sonuc.ok).toBe(true);
    if (!sonuc.ok) return;

    expect(sonuc.summary.total).toBe(3);
    expect(sonuc.summary.email).toBe("a@b.c");
    // GitHub verisi geri yüklenmez, ayrı listede görünür
    expect(sonuc.summary.skipped).toEqual([{ table: "github_commits", rows: 1 }]);
  });

  it("bozuk JSON'u reddeder", () => {
    const sonuc = parseBackup("{bozuk");
    expect(sonuc.ok).toBe(false);
    if (!sonuc.ok) expect(sonuc.error).toContain("JSON");
  });

  it("Bitig yedeği olmayan dosyayı reddeder", () => {
    const sonuc = parseBackup(JSON.stringify({ merhaba: "dunya" }));
    expect(sonuc.ok).toBe(false);
  });

  it("gelecekteki sürümü reddeder", () => {
    // Eski uygulama, yeni biçimi yanlış yorumlayıp veri bozmasın
    const sonuc = parseBackup(JSON.stringify({ version: 99, tables: {} }));
    expect(sonuc.ok).toBe(false);
    if (!sonuc.ok) expect(sonuc.error).toContain("sürüm");
  });

  it("boş tabloları saymaz", () => {
    const sonuc = parseBackup(
      JSON.stringify({ version: 1, tables: { mangas: [], projects: [{ id: "p" }] } }),
    );
    expect(sonuc.ok).toBe(true);
    if (!sonuc.ok) return;
    expect(sonuc.summary.counts).toEqual([{ table: "projects", rows: 1 }]);
  });
});

describe("satırları tekdüzeleştirme", () => {
  it("eksik anahtarları null'a tamamlar", () => {
    // PostgREST toplu eklemede tüm nesnelerin aynı anahtarlara sahip olmasını
    // ister; olmazsa "All object keys must match" ile tabloyu reddeder.
    const sonuc = tekduzeleştir([
      { id: "1", name: "Berserk", cover_url: "https://x" },
      { id: "2", name: "Vagabond" },
    ]);

    expect(Object.keys(sonuc[0]).sort()).toEqual(Object.keys(sonuc[1]).sort());
    expect(sonuc[1].cover_url).toBeNull();
    expect(sonuc[0].cover_url).toBe("https://x");
  });

  it("tek satırı olduğu gibi bırakır", () => {
    const girdi = [{ id: "1" }];
    expect(tekduzeleştir(girdi)).toBe(girdi);
  });

  it("zaten tekdüze veriyi bozmaz", () => {
    const sonuc = tekduzeleştir([
      { id: "1", name: "a" },
      { id: "2", name: "b" },
    ]);
    expect(sonuc).toEqual([
      { id: "1", name: "a" },
      { id: "2", name: "b" },
    ]);
  });
});
