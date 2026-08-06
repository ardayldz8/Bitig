type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 5000;

/**
 * Basit, süreç-içi sabit pencere sınırlayıcı.
 * Tek örnek için yeterlidir; çok örnekli dağıtımda paylaşımlı bir store gerekir.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now();

  // Süresi dolmuş kayıtları ara sıra temizle (sınırsız büyümeyi engelle)
  if (buckets.size > MAX_TRACKED_KEYS) {
    for (const [bucketKey, bucket] of buckets) {
      if (now > bucket.resetAt) buckets.delete(bucketKey);
    }
  }

  const existing = buckets.get(key);
  if (!existing || now > existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { ok: true, retryAfterSeconds: 0 };
}

/** İstemci kimliği (ters vekil başlıkları → yoksa sabit anahtar). */
export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";
  return `${scope}:${ip}`;
}
