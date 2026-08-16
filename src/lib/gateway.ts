import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Models offered in the UI. Must be a subset of the shared gds_live_ key's
 * model_whitelist on the gateway (Tooken-Pool) — anything else 403s at
 * request time. Configure via ALLOWED_MODELS, e.g. "gpt-5.5,claude-sonnet-4-5".
 */
export const ALLOWED_MODELS = (process.env.ALLOWED_MODELS ?? "gpt-4.1-mini")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

export const DEFAULT_MODEL = ALLOWED_MODELS[0];

export function isAllowedModel(model: string): boolean {
  return ALLOWED_MODELS.includes(model);
}

const baseURL = `${(process.env.GDS_GATEWAY_URL ?? "").replace(/\/+$/, "")}/v1`;

// The gateway's error contract is a flat {"error": "<message>"} (see
// app/utils/errors.py), not OpenAI's nested {"error": {"message": ...}} that
// the SDK's default error parser expects. createOpenAICompatible() has no
// public option to swap the error schema, so a small fetch middleware
// reshapes it on the way through — budget/rate-limit/model-whitelist errors
// then surface with their real message instead of a generic failure.
const gatewayFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (response.ok) return response;

  const raw = await response.clone().text();
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.error === "string") {
      return new Response(JSON.stringify({ error: { message: parsed.error } }), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }
  } catch {
    // Not JSON (or already the expected shape) — pass the response through.
  }
  return response;
};

// The gateway normalises every provider (OpenAI, Anthropic, MiniMax, Codex,
// Claude OAuth) to OpenAI chat-completion chunks, so a single OpenAI-compatible
// provider covers all of them — the model id alone decides which one is used
// on the other side of the gateway's model_whitelist check.
export const gateway = createOpenAICompatible({
  name: "gds-gateway",
  baseURL,
  apiKey: process.env.GDS_GATEWAY_KEY,
  includeUsage: true,
  fetch: gatewayFetch,
});
