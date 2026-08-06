import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWebhookSignature } from "@/lib/github/webhook";
import { buildWebhookUpdate } from "@/lib/github/webhook-types";

const SECRET = "test-webhook-secret";

function sign(body: string, secret = SECRET): string {
  return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

describe("verifyWebhookSignature", () => {
  const body = JSON.stringify({ action: "opened", number: 7 });

  it("geçerli imzayı kabul eder", () => {
    expect(verifyWebhookSignature(body, sign(body), SECRET)).toEqual({ ok: true });
  });

  it("yanlış secret ile imzalanmış isteği reddeder", () => {
    const result = verifyWebhookSignature(body, sign(body, "baska-secret"), SECRET);
    expect(result).toEqual({ ok: false, reason: "mismatch" });
  });

  it("gövde değiştirilmişse reddeder", () => {
    const signature = sign(body);
    const tampered = JSON.stringify({ action: "opened", number: 8 });
    expect(verifyWebhookSignature(tampered, signature, SECRET).ok).toBe(false);
  });

  it("imza başlığı yoksa reddeder", () => {
    expect(verifyWebhookSignature(body, null, SECRET)).toEqual({
      ok: false,
      reason: "missing_signature",
    });
  });

  it("sha256= öneki olmayan başlığı reddeder", () => {
    expect(verifyWebhookSignature(body, "sha1=abc", SECRET)).toEqual({
      ok: false,
      reason: "bad_format",
    });
  });

  it("secret tanımlı değilse reddeder", () => {
    expect(verifyWebhookSignature(body, sign(body), "")).toEqual({
      ok: false,
      reason: "missing_secret",
    });
  });

  it("farklı uzunluktaki imzada patlamaz", () => {
    expect(verifyWebhookSignature(body, "sha256=kisa", SECRET).ok).toBe(false);
  });
});

describe("buildWebhookUpdate", () => {
  it("push olayını commit sayısıyla özetler", () => {
    const update = buildWebhookUpdate("push", {
      ref: "refs/heads/main",
      repository: { full_name: "user/repo" },
      commits: [{ id: "abc123", message: "ilk" }, { id: "def456", message: "ikinci" }],
    });

    expect(update?.repositoryFullName).toBe("user/repo");
    expect(update?.activityType).toBe("push");
    expect(update?.title).toContain("2 commit");
    expect(update?.description).toContain("main");
  });

  it("merge edilmiş PR'ı doğru etiketler", () => {
    const update = buildWebhookUpdate("pull_request", {
      action: "closed",
      repository: { full_name: "user/repo" },
      pull_request: {
        number: 12,
        title: "Kalori sayfası",
        state: "closed",
        merged_at: "2026-01-01T00:00:00Z",
      },
    });

    expect(update?.title).toBe("PR #12 merge edildi");
  });

  it("workflow_run sonucunu başlığa taşır", () => {
    const update = buildWebhookUpdate("workflow_run", {
      repository: { full_name: "user/repo" },
      workflow_run: { id: 5, name: "CI", status: "completed", conclusion: "failure" },
    });

    expect(update?.title).toContain("failure");
  });

  it("desteklenmeyen event için null döner", () => {
    expect(buildWebhookUpdate("star", { repository: { full_name: "user/repo" } })).toBeNull();
  });

  it("bozuk payload'da null döner", () => {
    expect(buildWebhookUpdate("push", null)).toBeNull();
    expect(buildWebhookUpdate("pull_request", { pull_request: {} })).toBeNull();
  });
});
