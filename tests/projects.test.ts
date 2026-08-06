import { describe, expect, it } from "vitest";
import { computeMetrics } from "@/lib/projects/metrics";
import { computeHealth } from "@/lib/projects/health";
import { featureInputSchema, projectInputSchema } from "@/lib/projects/validation";
import {
  featureDraftSchema,
  githubIssueDraftSchema,
  projectSummarySchema,
} from "@/lib/ai/schemas";
import { renderMarkdown } from "@/lib/markdown";
import type { RepositorySnapshot } from "@/types/github";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 0, 31);

function snapshot(overrides: Partial<RepositorySnapshot> = {}): RepositorySnapshot {
  return {
    repository: {
      id: "user/repo",
      repositoryId: 1,
      fullName: "user/repo",
      name: "repo",
      description: null,
      isPrivate: false,
      defaultBranch: "main",
      htmlUrl: "",
      language: null,
      languages: {},
      branchCount: null,
      readme: null,
      updatedAt: new Date(NOW).toISOString(),
    },
    commits: [],
    pullRequests: [],
    issues: [],
    workflowRuns: [],
    releases: [],
    branches: [],
    files: [],
    syncedAt: new Date(NOW).toISOString(),
    ...overrides,
  };
}

describe("computeMetrics", () => {
  it("açık PR ve eski issue'ları sayar", () => {
    const metrics = computeMetrics({
      snapshot: snapshot({
        pullRequests: [
          { number: 1, title: "a", state: "open", merged: false, draft: false, authorLogin: null, createdAt: "", reviewState: null, checksState: null, htmlUrl: "" },
          { number: 2, title: "b", state: "closed", merged: true, draft: false, authorLogin: null, createdAt: "", reviewState: null, checksState: null, htmlUrl: "" },
        ],
        issues: [
          { number: 3, title: "eski", state: "open", labels: [], assigneeLogin: null, createdAt: new Date(NOW - 45 * DAY).toISOString(), htmlUrl: "" },
          { number: 4, title: "yeni", state: "open", labels: [], assigneeLogin: null, createdAt: new Date(NOW - 2 * DAY).toISOString(), htmlUrl: "" },
        ],
      }),
      features: [],
      tasks: [],
      now: NOW,
    });

    expect(metrics.openPullRequests).toBe(1);
    expect(metrics.openIssues).toBe(2);
    expect(metrics.staleIssues).toBe(1);
  });

  it("son commit yaşını gün olarak hesaplar", () => {
    const metrics = computeMetrics({
      snapshot: snapshot({
        commits: [
          { sha: "a", message: "m", authorName: null, authorLogin: null, committedAt: new Date(NOW - 10 * DAY).toISOString(), branch: null, htmlUrl: "" },
        ],
      }),
      features: [],
      tasks: [],
      now: NOW,
    });

    expect(metrics.daysSinceLastCommit).toBe(10);
  });

  it("GitHub bağlı değilken güvenli varsayılan döner", () => {
    const metrics = computeMetrics({ snapshot: null, features: [], tasks: [], now: NOW });
    expect(metrics.openPullRequests).toBe(0);
    expect(metrics.failingWorkflows).toBe(false);
    expect(metrics.daysSinceLastCommit).toBeNull();
  });
});

describe("computeHealth", () => {
  const base = computeMetrics({ snapshot: null, features: [], tasks: [], now: NOW });

  it("sorun yoksa sağlıklı döner", () => {
    const health = computeHealth(base);
    expect(health.level).toBe("healthy");
    expect(health.score).toBe(100);
  });

  it("CI başarısızsa puanı düşürür ve nedeni açıklar", () => {
    const health = computeHealth({ ...base, failingWorkflows: true });
    expect(health.score).toBe(70);
    expect(health.reasons.join(" ")).toContain("CI");
  });

  it("aynı girdi için deterministiktir", () => {
    const input = { ...base, failingWorkflows: true, staleIssues: 2, blockedFeatures: 1 };
    expect(computeHealth(input)).toEqual(computeHealth(input));
  });

  it("puan 0-100 aralığında kalır", () => {
    const health = computeHealth({
      ...base,
      failingWorkflows: true,
      daysSinceLastCommit: 400,
      openPullRequests: 30,
      staleIssues: 50,
      blockedFeatures: 20,
      highPriorityPending: 40,
    });
    expect(health.score).toBeGreaterThanOrEqual(0);
    expect(health.level).toBe("at_risk");
  });
});

describe("proje doğrulaması", () => {
  it("boş proje adını reddeder", () => {
    expect(projectInputSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("geçersiz repository adını reddeder", () => {
    expect(
      projectInputSchema.safeParse({ name: "X", githubFullName: "sadece-ad" }).success,
    ).toBe(false);
    expect(
      projectInputSchema.safeParse({ name: "X", githubFullName: "user/repo" }).success,
    ).toBe(true);
  });

  it("özellik başlığı zorunludur", () => {
    expect(featureInputSchema.safeParse({ title: "" }).success).toBe(false);
    expect(featureInputSchema.safeParse({ title: "Geçerli" }).success).toBe(true);
  });

  it("geçersiz hedef tarih biçimini reddeder", () => {
    expect(
      featureInputSchema.safeParse({ title: "X", targetDate: "31/01/2026" }).success,
    ).toBe(false);
  });
});

describe("AI structured output doğrulaması", () => {
  it("eksik alanlı özet reddedilir", () => {
    expect(projectSummarySchema.safeParse({ overview: "x" }).success).toBe(false);
  });

  it("geçersiz öncelik değeri reddedilir", () => {
    expect(
      featureDraftSchema.safeParse({
        title: "x",
        description: "y",
        acceptanceCriteria: [],
        priority: "cok-yuksek",
        suggestedLabels: [],
        relatedFiles: [],
      }).success,
    ).toBe(false);
  });

  it("geçerli issue taslağı kabul edilir", () => {
    expect(
      githubIssueDraftSchema.safeParse({ title: "Başlık", body: "Gövde", labels: ["bug"] })
        .success,
    ).toBe(true);
  });
});

describe("markdown güvenliği", () => {
  it("HTML etiketlerini çalıştırmaz", () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)">');
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("script etiketini kaçışlar", () => {
    const html = renderMarkdown("<script>alert(1)</script>");
    expect(html).not.toContain("<script>");
  });

  it("javascript: bağlantılarını engeller", () => {
    const html = renderMarkdown("[tıkla](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("tıkla");
  });

  it("izin verilen biçimlendirmeyi uygular", () => {
    expect(renderMarkdown("**kalın**")).toContain("<strong>kalın</strong>");
    expect(renderMarkdown("- madde")).toContain("<li>madde</li>");
    expect(renderMarkdown("[Bitig](https://example.com)")).toContain(
      'href="https://example.com/"',
    );
  });
});
