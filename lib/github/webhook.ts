import { createHmac, timingSafeEqual } from "node:crypto";

export type SignatureResult =
  | { ok: true }
  | { ok: false; reason: "missing_secret" | "missing_signature" | "bad_format" | "mismatch" };

/**
 * GitHub webhook imzasını doğrular.
 *
 * - HAM gövde (raw body) kullanılır; JSON.parse edilmiş nesne İMZAYI BOZAR.
 * - Karşılaştırma timing-safe yapılır (byte-byte erken çıkış yok).
 * - İmza doğrulanmadan payload asla işlenmez.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): SignatureResult {
  if (!secret) return { ok: false, reason: "missing_secret" };
  if (!signatureHeader) return { ok: false, reason: "missing_signature" };
  if (!signatureHeader.startsWith("sha256=")) return { ok: false, reason: "bad_format" };

  const expected = `sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;

  const received = Buffer.from(signatureHeader, "utf8");
  const computed = Buffer.from(expected, "utf8");

  // timingSafeEqual eşit olmayan uzunlukta throw eder; önce uzunluğu kıyasla.
  if (received.length !== computed.length) return { ok: false, reason: "mismatch" };
  if (!timingSafeEqual(received, computed)) return { ok: false, reason: "mismatch" };

  return { ok: true };
}

export const SIGNATURE_HEADER = "x-hub-signature-256";
export const DELIVERY_HEADER = "x-github-delivery";
export const EVENT_HEADER = "x-github-event";
