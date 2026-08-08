export type TriageDecision = "active" | "done" | "someday" | "junk";

export type RepoSnapshot = {
  fullName: string;
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
  language: string | null;
  description: string | null;
  htmlUrl: string | null;
  pushedAt: string | null;
  openIssues: number;
  openPrs: number;
  /** success / failure / cancelled … Bilinmiyorsa null. */
  ciConclusion: string | null;
  ciAt: string | null;
};

export type RepoWithTriage = RepoSnapshot & {
  decision: TriageDecision | null;
  note: string | null;
};

/** Son push'tan bu yana geçen gün. Hiç push yoksa null. */
export function daysSincePush(repo: RepoSnapshot, now: Date): number | null {
  if (!repo.pushedAt) return null;
  const fark = now.getTime() - new Date(repo.pushedAt).getTime();
  return Math.floor(fark / 86_400_000);
}

export type RepoGroup = "aktif" | "duraklamis" | "bayat";

/**
 * Zaman grubu.
 *
 * Eşikler keyfi değil: 30 gün "bu ay dokundum", 90 gün "bir çeyrek geçti".
 * Üçten fazla grup, 37 repo'yu anlamlı biçimde bölmüyor — sadece göz yoruyor.
 */
export function groupOf(repo: RepoSnapshot, now: Date): RepoGroup {
  const gun = daysSincePush(repo, now);
  if (gun === null) return "bayat";
  if (gun <= 30) return "aktif";
  if (gun <= 90) return "duraklamis";
  return "bayat";
}

/**
 * Dikkat puanı: repo sizi ne kadar bekliyor.
 *
 * Tarihe göre sıralamak yetmiyor — dün dokunulmuş ama hiçbir şey bekleyen
 * repo, üç hafta önce CI'ı kırılmış repodan daha az acil. Bu yüzden
 * "ne kadar yeni" değil "ne kadar iş var" ölçülüyor.
 *
 * Kırık CI en ağır: sessizce bozuk duran bir proje, unutulmuş bir projeden
 * daha maliyetli. Ama YALNIZCA hâlâ aktif olan repolarda — 300 gündür
 * uyuyan bir repoda kırık CI kimseyi rahatsız etmiyor.
 */
export function attentionScore(repo: RepoWithTriage, now: Date): number {
  // Karar verilmiş repolar listeyi meşgul etmemeli
  if (repo.decision === "done" || repo.decision === "junk") return 0;
  if (repo.isArchived) return 0;

  const gun = daysSincePush(repo, now);
  const canli = gun !== null && gun <= 90;

  let puan = 0;
  if (canli && repo.ciConclusion === "failure") puan += 100;
  puan += repo.openPrs * 20;
  puan += Math.min(repo.openIssues, 20) * 3;

  // Tazelik küçük bir ağırlık: eşitlik bozucu, belirleyici değil
  if (gun !== null && gun <= 30) puan += (30 - gun) / 10;

  return puan;
}

/** Dikkat puanına göre azalan; eşitlikte en son dokunulan üstte. */
export function sortByAttention(repos: RepoWithTriage[], now: Date): RepoWithTriage[] {
  return [...repos].sort((a, b) => {
    const fark = attentionScore(b, now) - attentionScore(a, now);
    if (fark !== 0) return fark;

    const ga = daysSincePush(a, now);
    const gb = daysSincePush(b, now);
    if (ga === null) return 1;
    if (gb === null) return -1;
    return ga - gb;
  });
}

export type InventorySummary = {
  toplam: number;
  aktif: number;
  duraklamis: number;
  bayat: number;
  /** Karar bekleyen bayat repolar — triyajın asıl hedefi. */
  kararsizBayat: number;
  kirikCi: number;
  acikPr: number;
};

export function summarize(repos: RepoWithTriage[], now: Date): InventorySummary {
  const ozet: InventorySummary = {
    toplam: repos.length,
    aktif: 0,
    duraklamis: 0,
    bayat: 0,
    kararsizBayat: 0,
    kirikCi: 0,
    acikPr: 0,
  };

  for (const repo of repos) {
    const grup = groupOf(repo, now);
    ozet[grup]++;

    if (grup === "bayat" && repo.decision === null) ozet.kararsizBayat++;

    // Kırık CI yalnızca canlı repolarda sayılır; ölü repoda anlamı yok
    if (grup !== "bayat" && repo.ciConclusion === "failure") ozet.kirikCi++;
    ozet.acikPr += repo.openPrs;
  }

  return ozet;
}

export const DECISION_LABELS: Record<TriageDecision, string> = {
  active: "Devam ediyor",
  done: "Bitti",
  someday: "Bir gün dönerim",
  junk: "Çöp",
};
