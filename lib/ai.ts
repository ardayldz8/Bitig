import { geminiGenerate, DEFAULT_MODELS as GEMINI_MODELS } from "./gemini";

// OpenRouter: tek anahtarla çok model + otomatik fallback (OpenAI-uyumlu API).
// Birincil: google/gemini-2.5-flash — kafa-kafaya testte en iyi (hızlı ~2s, Türkçe +
// JSON + çoklu-niyet doğru; reasoning yok → ucuz). Hata verirse sıradakine düşer.
const OPENROUTER_MODELS = [
  "google/gemini-2.5-flash", // BİRİNCİL: hızlı + isabetli
  "qwen/qwen3.5-flash-02-23", // yedek: hızlı, Türkçe güçlü
  "meta-llama/llama-3.3-70b-instruct:free", // ücretsiz son yedek
];

export interface GenOptions {
  system: string;
  user: string;
  json?: boolean;
  temperature?: number;
  effort?: "minimal" | "low" | "medium" | "high"; // gpt-5 reasoning çabası (vars. minimal=hızlı)
  models?: string[]; // verilirse OPENROUTER_MODELS yerine bu zincir denenir
}

export function hasAiKey(): boolean {
  return !!(process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY);
}

async function openrouterGenerate(opts: GenOptions): Promise<string | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  const chain = opts.models?.length ? opts.models : OPENROUTER_MODELS;
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-Title": "duzen",
    },
    body: JSON.stringify({
      model: chain[0],
      models: chain, // OpenRouter: birinci başarısızsa sıradakine geçer
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      temperature: opts.temperature ?? 0.4,
      // gpt-5 reasoning modellerini hızlandırır; reasoning olmayan modeller yok sayar
      reasoning: { effort: opts.effort ?? "minimal" },
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
