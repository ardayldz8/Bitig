/**
 * Kayıt kimliği. Veritabanı `default gen_random_uuid()` tanımlasa da id
 * istemcide üretilir: iyimser güncellemede ekranda görünen kayıtla sunucudaki
 * satırın kimliği aynı olsun, Realtime tazelemesinde liste yeniden anahtarlanıp
 * titremesin diye.
 */
export function createId(): string {
  const webCrypto: Crypto | undefined = typeof crypto === "undefined" ? undefined : crypto;

  if (typeof webCrypto?.randomUUID === "function") {
    return webCrypto.randomUUID();
  }

  // randomUUID yoksa (eski tarayıcı, güvensiz köken) geçerli biçimde v4 üret
  const bytes = new Uint8Array(16);
  if (typeof webCrypto?.getRandomValues === "function") {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
