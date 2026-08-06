import type { ProjectMetrics } from "@/lib/projects/metrics";

export type HealthLevel = "healthy" | "attention" | "at_risk";

export type ProjectHealth = {
  level: HealthLevel;
  score: number; // 0-100
  /** Puanı düşüren somut nedenler — AI değil, ölçülen veriler. */
  reasons: string[];
};

export const HEALTH_LABELS: Record<HealthLevel, string> = {
  healthy: "Sağlıklı",
  attention: "Dikkat gerekiyor",
  at_risk: "Riskli",
};

/**
 * Tamamen deterministik sağlık hesabı — aynı girdi her zaman aynı çıktıyı verir.
 * AI bu sonucu yalnızca yorumlar, değiştiremez.
 */
export function computeHealth(metrics: ProjectMetrics): ProjectHealth {
  let score = 100;
  const reasons: string[] = [];

  if (metrics.failingWorkflows) {
    score -= 30;
    reasons.push("Son CI çalışması başarısız.");
  }

  if (metrics.daysSinceLastCommit !== null) {
    if (metrics.daysSinceLastCommit > 60) {
      score -= 25;
      reasons.push(`${metrics.daysSinceLastCommit} gündür commit yok.`);
    } else if (metrics.daysSinceLastCommit > 21) {
      score -= 12;
      reasons.push(`Son commit ${metrics.daysSinceLastCommit} gün önce.`);
    }
  }

  if (metrics.openPullRequests > 5) {
    score -= 12;
    reasons.push(`${metrics.openPullRequests} açık pull request birikmiş.`);
  }

  if (metrics.staleIssues > 0) {
    score -= Math.min(15, metrics.staleIssues * 3);
    reasons.push(`${metrics.staleIssues} issue 30 günden eski.`);
  }

  if (metrics.blockedFeatures > 0) {
    score -= Math.min(15, metrics.blockedFeatures * 5);
    reasons.push(`${metrics.blockedFeatures} özellik engellenmiş durumda.`);
  }

  if (metrics.highPriorityPending > 3) {
    score -= 10;
    reasons.push(`${metrics.highPriorityPending} yüksek öncelikli özellik bekliyor.`);
  }

  const bounded = Math.max(0, Math.min(100, score));
  const level: HealthLevel =
    bounded >= 75 ? "healthy" : bounded >= 45 ? "attention" : "at_risk";

  return { level, score: bounded, reasons };
}
