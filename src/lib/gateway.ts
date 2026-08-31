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
const createGatewayFetch = (bodyExtras?: Record<string, unknown>): typeof fetch => async (
  input,
  init,
) => {
  // Extra request fields are merged here rather than passed as providerOptions:
  // the openai-compatible provider validates those against a fixed schema
  // (user/reasoningEffort/textVerbosity/strictJsonSchema) and silently strips
  // anything else, so web_search_options would never reach the wire.
  const request =
    bodyExtras && typeof init?.body === "string"
      ? { ...init, body: JSON.stringify({ ...JSON.parse(init.body), ...bodyExtras }) }
      : init;

  const response = await fetch(input, request);
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
const providerSettings = {
  name: "gds-gateway",
  baseURL,
  apiKey: process.env.GDS_GATEWAY_KEY,
  includeUsage: true,
};

/**
 * Asks the gateway to offer Codex's built-in image tool even though this app
 * sends function tools of its own.
 *
 * The gateway withholds that tool from any request carrying function tools
 * (`codex_adapter.py`: `has_function_tools`) — a rule aimed at agent clients that
 * flood a request with tools and never pick it. This app sends two, which was
 * enough to trip it, so "draw me a red circle" came back as an SVG code block
 * the model wrote by hand. The flag is the gateway's explicit opt-in and
 * overrides that heuristic; unknown to the other adapters, which ignore it.
 */
const OFFER_IMAGE_TOOL = { image_generation: true };

export const gateway = createOpenAICompatible({
  ...providerSettings,
  fetch: createGatewayFetch({ ...OFFER_IMAGE_TOOL }),
});

/**
 * Same gateway, with OpenAI's hosted web search switched on: the search runs
 * on OpenAI's side and the results are injected into the prompt before the
 * model answers, so there's no third-party search key or crawler here.
 *
 * That injection is why search is opt-in per message (the globe in the
 * composer) — it pushes a request from a few hundred prompt tokens to roughly
 * 10-16k, against the one shared gateway key.
 */
const gatewaySearch = createOpenAICompatible({
  ...providerSettings,
  fetch: createGatewayFetch({ web_search_options: {}, ...OFFER_IMAGE_TOOL }),
});

export function gatewayFor(webSearch: boolean) {
  return webSearch ? gatewaySearch : gateway;
}
