import { z } from "zod";
import { env, openRouterStatus } from "@/lib/env";
import { AI_SECURITY_PREAMBLE } from "@/lib/ai/security";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 60_000;

export class ProjectAiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ProjectAiError";
  }
}

export function isProjectAiConfigured(): boolean {
  return openRouterStatus().configured;
}

type JsonSchemaSpec = { name: string; strict: boolean; schema: unknown };

/**
 * Structured-output OpenRouter çağrısı ve Zod doğrulaması.
 * Model adı env'den gelir; hiçbir yerde hardcode edilmez.
 * Doğrulanamayan çıktı KAYDEDİLMEZ, kontrollü hata döner.
 */
export async function generateStructured<T>(input: {
  systemPrompt: string;
  userPrompt: string;
  jsonSchema: JsonSchemaSpec;
  schema: z.ZodType<T>;
  signal?: AbortSignal;
}): Promise<T> {
  if (!isProjectAiConfigured()) {
    throw new ProjectAiError("ai_not_configured", 503);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  input.signal?.addEventListener("abort", onAbort);

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openRouterKey()}`,
        "Content-Type": "application/json",
        "X-Title": "Bitig Projeler",
      },
      body: JSON.stringify({
        model: env.projectModel(),
        temperature: 0.2,
        max_tokens: 2500,
        messages: [
          { role: "system", content: `${AI_SECURITY_PREAMBLE}\n\n${input.systemPrompt}` },
          { role: "user", content: input.userPrompt },
        ],
        response_format: { type: "json_schema", json_schema: input.jsonSchema },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ProjectAiError(`openrouter_${response.status}`, 502);
    }

    const payload: unknown = await response.json();
    const content = extractContent(payload);
    if (!content) throw new ProjectAiError("empty_response", 502);

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new ProjectAiError("invalid_json", 502);
    }

    const validated = input.schema.safeParse(parsed);
    if (!validated.success) {
      throw new ProjectAiError("schema_validation_failed", 502);
    }

    return validated.data;
  } finally {
    clearTimeout(timer);
    input.signal?.removeEventListener("abort", onAbort);
  }
}

function extractContent(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = (choices[0] as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) return null;
  const content = (message as { content?: unknown }).content;
  return typeof content === "string" && content.trim() ? content : null;
}

/** Kullanıcıya gösterilecek, ham servis hatası içermeyen mesaj. */
export function aiErrorMessage(error: unknown): string {
  if (error instanceof ProjectAiError) {
    if (error.message === "ai_not_configured") {
      return "AI özellikleri yapılandırılmamış (OPENROUTER_API_KEY eksik).";
    }
    if (error.message === "schema_validation_failed" || error.message === "invalid_json") {
      return "AI yanıtı beklenen biçimde gelmedi. Tekrar dener misin?";
    }
  }
  return "AI şu anda yanıt veremedi. Birazdan tekrar dene.";
}
