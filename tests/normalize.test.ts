import { describe, expect, it } from "vitest";
import {
  detectTechnologies,
  normalizeIssue,
  normalizePullRequest,
  normalizeTree,
  shouldSkipPath,
} from "@/lib/github/normalize";
import { isSecretPath, redactSecrets } from "@/lib/ai/security";

describe("normalizeIssue", () => {
  it("pull request'leri issue listesinden ayıklar", () => {
    const asIssue = normalizeIssue({
      number: 3,
      title: "PR aslında",
      state: "open",
      pull_request: { url: "..." },
      created_at: "2026-01-01T00:00:00Z",
    });
    expect(asIssue).toBeNull();
  });

  it("etiketleri hem string hem nesne biçiminde okur", () => {
    const issue = normalizeIssue({
      number: 4,
      title: "Hata",
      state: "open",
      labels: ["bug", { name: "high" }],
      created_at: "2026-01-01T00:00:00Z",
    });
    expect(issue?.labels).toEqual(["bug", "high"]);
  });
});

describe("normalizePullRequest", () => {
  it("merged_at doluysa merged=true olur", () => {
    const pr = normalizePullRequest({
      number: 1,
      title: "Test",
      state: "closed",
      merged_at: "2026-01-01T00:00:00Z",
    });
    expect(pr?.merged).toBe(true);
  });

  it("gereksiz kişisel veriyi taşımaz", () => {
    const pr = normalizePullRequest({
      number: 2,
      title: "Test",
      state: "open",
      user: { login: "ardab", email: "gizli@example.com", avatar_url: "http://x" },
    });
    expect(pr?.authorLogin).toBe("ardab");
    expect(JSON.stringify(pr)).not.toContain("gizli@example.com");
    expect(JSON.stringify(pr)).not.toContain("avatar");
  });
});

describe("dosya ağacı sınırları", () => {
  it("büyük klasörleri atlar", () => {
    expect(shouldSkipPath("node_modules/react/index.js")).toBe(true);
    expect(shouldSkipPath(".next/static/x.js")).toBe(true);
    expect(shouldSkipPath("dist/main.js")).toBe(true);
    expect(shouldSkipPath("src/app/page.tsx")).toBe(false);
  });

  it("çok büyük dosyaları listeye almaz ve önemlileri öne alır", () => {
    const nodes = normalizeTree(
      {
        tree: [
          { path: "src/index.ts", type: "blob", size: 500 },
          { path: "huge.bin", type: "blob", size: 5_000_000 },
          { path: "README.md", type: "blob", size: 1200 },
          { path: "node_modules/x/y.js", type: "blob", size: 100 },
        ],
      },
      "user/repo",
      "main",
    );

    const paths = nodes.map((node) => node.path);
    expect(paths).not.toContain("huge.bin");
    expect(paths).not.toContain("node_modules/x/y.js");
    expect(paths[0]).toBe("README.md"); // önemli dosya başa alınır
  });
});

describe("detectTechnologies", () => {
  it("package.json bağımlılıklarından teknoloji çıkarır", () => {
    const tech = detectTechnologies({
      "package.json": JSON.stringify({
        dependencies: { next: "15", react: "19" },
        devDependencies: { typescript: "5", vitest: "4" },
      }),
    });
    expect(tech).toContain("Next.js");
    expect(tech).toContain("React");
    expect(tech).toContain("TypeScript");
    expect(tech).toContain("Vitest");
  });

  it("bozuk package.json'da çökmez", () => {
    expect(() => detectTechnologies({ "package.json": "{bozuk" })).not.toThrow();
  });

  it("diğer ekosistemleri tanır", () => {
    expect(detectTechnologies({ "go.mod": "module x" })).toContain("Go");
    expect(detectTechnologies({ "Cargo.toml": "[package]" })).toContain("Rust");
  });
});

describe("secret filtreleme", () => {
  it("secret içerebilecek yolları işaretler", () => {
    expect(isSecretPath(".env")).toBe(true);
    expect(isSecretPath(".env.local")).toBe(true);
    expect(isSecretPath("certs/server.pem")).toBe(true);
    expect(isSecretPath("config/credentials.json")).toBe(true);
    expect(isSecretPath("src/env.ts")).toBe(false);
  });

  it("metne gömülü token'ları maskeler", () => {
    // Sahte token bilerek parçalardan kurulur: kaynak dosyada gerçek bir
    // GitHub token'ına benzeyen bitişik dize bulunmasın diye. Aksi hâlde
    // CI'daki secret tarayıcıları (Netlify vb.) bunu gerçek sızıntı sanıp
    // derlemeyi durduruyor.
    const fakeGithubToken = ["gh", "p", "_", "abcdefghijklmnopqrstuvwxyz012345"].join("");
    const fakeDbUrl = ["postgres", "://u:p@host/db"].join("");

    const redacted = redactSecrets(`token: ${fakeGithubToken} ve ${fakeDbUrl}`);

    expect(redacted).not.toContain(fakeGithubToken);
    expect(redacted).not.toContain(fakeDbUrl);
    expect(redacted).toContain("[GITHUB_TOKEN_GIZLENDI]");
    expect(redacted).toContain("[DB_URL_GIZLENDI]");
  });
});
