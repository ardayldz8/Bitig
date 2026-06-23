import { geminiGenerate, DEFAULT_MODELS as GEMINI_MODELS } from "./gemini";

// OpenRouter: tek anahtarla çok model + otomatik fallback (OpenAI-uyumlu API).
// Birincil ÜCRETLİ gpt-5-nano (tutarlı, native JSON, iyi Türkçe); hata verirse
// sıradaki ÜCRETSİZ yedeklere düşer. ~$0.0002/çağrı → $3.67 ≈ 19 bin çağrı.
const OPENROUTER_MODELS = [
  "openai/gpt-5-nano", // BİRİNCİL (ücretli): güvenilir, hızlı, native JSON
  "qwen/qwen3-next-80b-a3b-instruct:free", // ücretsiz yedek 1
  "meta-llama/llama-3.3-70b-instruct:free", // ücretsiz yedek 2
];

export interface GenOptions {
  system: string;
  user: string;
  json?: boolean;
  temperature?: number;
}

export function hasAiKey(): boolean {
  return !!(process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY);
}

async function openrouterGenerate(opts: GenOptions): Promise<string | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-Title": "duzen",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODELS[0],
      models: OPENROUTER_MODELS, // OpenRouter: birinci başarısızsa sıradakine geçer
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      temperature: opts.temperature ?? 0.4,
      // gpt-5 reasoning modellerini hızlandırır (70s -> ~2s); reasoning olmayan modeller yok sayar
      reasoning: { effort: "minimal" },
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error("openrouter_" + res.status);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  return typeof text === "string" && text.trim() ? text : null;
}

/**
 * Metin üretir. Önce OpenRouter (çok modelli, güvenilir), o yoksa/başarısızsa Gemini.
 * Hiç anahtar yoksa null (çağıran kural-tabanlı yedeğe düşer).
 */
export async function aiGenerate(opts: GenOptions): Promise<string | null> {
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const t = await openrouterGenerate(opts);
      if (t) return t;
    } catch {
      // OpenRouter başarısız -> Gemini'ye düş
    }
  }
  return geminiGenerate({ models: GEMINI_MODELS, ...opts });
}
