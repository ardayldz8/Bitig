// Google Gemini (ücretsiz katman) için ince REST sarmalayıcı.
// Geçici hatalarda (429/5xx) tekrar dener; bir model yoğunsa (503) sıradaki modele geçer.
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

// Sırayla denenecek modeller (farklı kapasite havuzları -> 503'e karşı dayanıklılık).
export const DEFAULT_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-flash-lite",
];

export function hasGeminiKey(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

interface GenerateOptions {
  models: string[];
  system: string;
  user: string;
  json?: boolean; // true => responseMimeType: application/json
  temperature?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Gemini'den metin üretir. Anahtar yoksa null döner.
 * Her modeli 2 kez dener; geçici hata/yoğunlukta sıradaki modele geçer.
 * Hiçbiri başaramazsa son hatayı throw eder.
 */
export async function geminiGenerate(opts: GenerateOptions): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const payload = {
    system_instruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts: [{ text: opts.user }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.4,
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
    },
  };

  let lastErr: unknown = new Error("gemini_failed");
  for (const model of opts.models) {
    const url = `${ENDPOINT}/${model}:generateContent?key=${key}`;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await sleep(350);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (typeof text === "string" && text.trim()) return text;
          lastErr = new Error("gemini_empty");
          break; // boş yanıt -> sıradaki modeli dene
        }
        lastErr = new Error(`gemini_${model}_${res.status}`);
        if (!RETRYABLE.has(res.status)) break; // kalıcı hata -> sıradaki modele geç
      } catch (e) {
        lastErr = e; // ağ hatası -> tekrar dene
      }
    }
  }
  throw lastErr;
}
