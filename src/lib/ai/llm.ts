import { z } from "zod";

/** The AI service is unreachable, misconfigured or returned something unusable. */
export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

const TIMEOUT_MS = 30_000;

function extractJson(content: string): string {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  return start >= 0 && end > start ? content.slice(start, end + 1) : content;
}

async function callKimi(system: string, user: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) throw new AiUnavailableError("AI is not configured");

  let response: Response;
  try {
    response = await fetch(process.env.KIMI_API_URL || "https://api.moonshot.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.KIMI_MODEL || "kimi-k3",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.3,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    console.error("AI provider request failed");
    throw new AiUnavailableError("AI service is unreachable");
  }

  if (!response.ok) {
    console.error("Kimi returned status", response.status);
    throw new AiUnavailableError("AI service returned an error");
  }

  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new AiUnavailableError("AI service returned an empty response");
  return content;
}

/**
 * Ask the model for a JSON object and validate it against a schema.
 * One retry on malformed output. Nothing unvalidated is ever returned.
 */
export async function completeJson<S extends z.ZodType>(options: {
  system: string;
  user: string;
  schema: S;
  maxTokens?: number;
}): Promise<z.infer<S>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const content = await callKimi(options.system, options.user, options.maxTokens ?? 2000);
    try {
      return options.schema.parse(JSON.parse(extractJson(content)));
    } catch {
      // retry once with a fresh completion
    }
  }
  throw new AiUnavailableError("AI returned an invalid response");
}
