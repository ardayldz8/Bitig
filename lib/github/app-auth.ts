import { createSign } from "node:crypto";
import { env, githubAppStatus } from "@/lib/env";

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * GitHub App JWT'si üretir (RS256, private key ile imzalanır).
 * Yalnızca sunucuda çalışır; private key hiçbir zaman istemciye gitmez.
 */
export function createAppJwt(nowSeconds: number = Math.floor(Date.now() / 1000)): string {
  const status = githubAppStatus();
  if (!status.configured) {
    throw new Error("github_app_not_configured");
  }

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    // Saat kaymasına karşı 60 sn geriye al
    iat: nowSeconds - 60,
    exp: nowSeconds + 9 * 60, // GitHub üst sınırı 10 dk
    iss: env.githubAppId(),
  };

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;

  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = base64url(signer.sign(env.githubPrivateKey()));

  return `${unsigned}.${signature}`;
}
