import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * TOTP kurtarma kodları.
 *
 * Kod üretimi ve doğrulaması yalnızca SUNUCUDA yapılır; istemciye hash bile
 * gönderilmez. Kodlar bir kez gösterilir, sonra yalnızca hash'i saklanır.
 */

/** Karıştırılabilecek karakterler (0/O, 1/I/l) bilerek dışarıda. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const GROUP = 4;
const GROUPS = 2;
export const CODE_COUNT = 10;

/**
 * `XXXX-XXXX` biçiminde kod. 31^8 ≈ 8.5×10^11 olasılık; deneme sınırıyla
 * birlikte kaba kuvvet pratik değil.
 */
export function generateCode(): string {
  const bytes = randomBytes(GROUP * GROUPS);
  const chars = Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]);

  const parts: string[] = [];
  for (let i = 0; i < GROUPS; i += 1) {
    parts.push(chars.slice(i * GROUP, (i + 1) * GROUP).join(""));
  }
  return parts.join("-");
}

export function generateCodes(count: number = CODE_COUNT): string[] {
  const codes = new Set<string>();
  // Çakışma neredeyse imkânsız ama küme yine de tekrarı engeller
  while (codes.size < count) codes.add(generateCode());
  return [...codes];
}

/**
 * Girdi normalize edilir: kullanıcı tireyi atlayabilir, küçük harf yazabilir
 * ya da boşluk bırakabilir.
 */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Kodlar yüksek entropili rastgele dizeler; sözlük saldırısı hedefi olmadığı
 * için yavaş hash gerekmiyor. Önemli olan düz metin saklanmaması.
 */
export function hashCode(code: string): string {
  return createHash("sha256").update(normalizeCode(code)).digest("hex");
}

/** Hash karşılaştırması sabit zamanlı yapılır. */
export function hashesEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}
