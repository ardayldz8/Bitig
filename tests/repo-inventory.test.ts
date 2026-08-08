import { describe, expect, it } from "vitest";
import {
  attentionScore,
  daysSincePush,
  groupOf,
  sortByAttention,
  summarize,
  type RepoWithTriage,
} from "@/lib/repos/inventory";

const SIMDI = new Date("2026-08-07T12:00:00Z");

/** `gunOnce` gün önce push edilmiş bir repo. */
const repo = (gunOnce: number | null, over: Partial<RepoWithTriage> = {}): RepoWithTriage => ({
  fullName: over.fullName ?? "ardayldz8/deneme",
  isPrivate: false,
  isFork: false,
  isArchived: false,
  language: "TypeScript",
  description: null,
  htmlUrl: null,
  pushedAt:
    gunOnce === null
      ? null
      : new Date(SIMDI.getTime() - gunOnce * 86_400_000).toISOString(),
  openIssues: 0,
  openPrs: 0,
  ciConclusion: null,
  ciAt: null,
  decision: null,
  note: null,
  ...over,
});

describe("zaman grupları", () => {
  it("gerçek repo listesindeki eşikleri ayırır", () => {
    // Kullanıcının gerçek dağılımı: 1, 5, 26, 61, 426 gün
    expect(groupOf(repo(1), SIMDI)).toBe("aktif");
    expect(groupOf(repo(26), SIMDI)).toBe("aktif");
    expect(groupOf(repo(61), SIMDI)).toBe("duraklamis");
    expect(groupOf(repo(426), SIMDI)).toBe("bayat");
  });

  it("sınırlar kapsayıcı", () => {
    expect(groupOf(repo(30), SIMDI)).toBe("aktif");
    expect(groupOf(repo(31), SIMDI)).toBe("duraklamis");
    expect(groupOf(repo(90), SIMDI)).toBe("duraklamis");
    expect(groupOf(repo(91), SIMDI)).toBe("bayat");
  });

  it("hiç push edilmemiş repo bayat sayılır", () => {
    expect(groupOf(repo(null), SIMDI)).toBe("bayat");
    expect(daysSincePush(repo(null), SIMDI)).toBeNull();
  });
});

describe("dikkat puanı", () => {
  it("kırık CI her şeyin önüne geçer", () => {
    const kirik = repo(10, { ciConclusion: "failure" });
    const cokIssue = repo(1, { openIssues: 15 });

    expect(attentionScore(kirik, SIMDI)).toBeGreaterThan(attentionScore(cokIssue, SIMDI));
  });

  it("ÖLÜ repoda kırık CI önemsiz", () => {
    // 300 gündür uyuyan bir projenin testi kırık diye kimse rahatsız olmuyor
    const oluKirik = repo(300, { ciConclusion: "failure" });
    const canliIssue = repo(5, { openIssues: 2 });

    expect(attentionScore(oluKirik, SIMDI)).toBeLessThan(attentionScore(canliIssue, SIMDI));
  });

  it("açık PR issue'dan ağır basar", () => {
    // PR beklemek, issue biriktirmekten daha acil bir borç
    expect(attentionScore(repo(5, { openPrs: 1 }), SIMDI)).toBeGreaterThan(
      attentionScore(repo(5, { openIssues: 5 }), SIMDI),
    );
  });

  it("karar verilmiş repo listeyi meşgul etmez", () => {
    const bitmis = repo(2, { openPrs: 3, openIssues: 10, decision: "done" });
    const cop = repo(2, { openIssues: 10, decision: "junk" });

    expect(attentionScore(bitmis, SIMDI)).toBe(0);
    expect(attentionScore(cop, SIMDI)).toBe(0);
  });

  it("'bir gün dönerim' listede kalır", () => {
    // Karar verildi ama iş bitmedi; tamamen gizlemek yanlış olur
    expect(attentionScore(repo(2, { openIssues: 5, decision: "someday" }), SIMDI))
      .toBeGreaterThan(0);
  });

  it("arşivlenmiş repo sıfırlanır", () => {
    expect(attentionScore(repo(1, { openPrs: 2, isArchived: true }), SIMDI)).toBe(0);
  });

  it("hiçbir şey bekleyen yoksa taze repo yine de az puan alır", () => {
    const dun = attentionScore(repo(1), SIMDI);
    const ucHafta = attentionScore(repo(21), SIMDI);
    expect(dun).toBeGreaterThan(ucHafta);
    expect(ucHafta).toBeGreaterThanOrEqual(0);
  });
});

describe("sıralama", () => {
  it("işi olan repo, yeni ama boş repodan önce gelir", () => {
    const liste = [
      repo(0, { fullName: "a/dun-dokundum" }),
      repo(20, { fullName: "a/ci-kirik", ciConclusion: "failure" }),
      repo(3, { fullName: "a/pr-bekliyor", openPrs: 2 }),
    ];

    const sirali = sortByAttention(liste, SIMDI).map((r) => r.fullName);
    expect(sirali).toEqual(["a/ci-kirik", "a/pr-bekliyor", "a/dun-dokundum"]);
  });

  it("eşit puanda son dokunulan üstte", () => {
    const liste = [repo(50, { fullName: "a/eski" }), repo(40, { fullName: "a/yeni" })];
    expect(sortByAttention(liste, SIMDI)[0].fullName).toBe("a/yeni");
  });
});

describe("özet", () => {
  it("gerçek dağılımı sayar", () => {
    const liste = [
      repo(1, { fullName: "a/1", ciConclusion: "failure" }),
      repo(1, { fullName: "a/2", openIssues: 15, openPrs: 2 }),
      repo(61, { fullName: "a/3" }),
      repo(200, { fullName: "a/4" }),
      repo(400, { fullName: "a/5", decision: "done" }),
    ];

    const o = summarize(liste, SIMDI);
    expect(o.toplam).toBe(5);
    expect(o.aktif).toBe(2);
    expect(o.duraklamis).toBe(1);
    expect(o.bayat).toBe(2);
    // Karar verilmiş olan sayılmaz — triyajın hedefi karar BEKLEYENLER
    expect(o.kararsizBayat).toBe(1);
    expect(o.kirikCi).toBe(1);
    expect(o.acikPr).toBe(2);
  });
});
