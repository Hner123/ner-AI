/**
 * How a model id is shown in the picker.
 *
 * The Console direction sets these in monospace, where the raw gateway id
 * ("gpt-5.6-terra") reads better than a prettified label — and it's what you'd
 * put in ALLOWED_MODELS or the gateway's whitelist, so showing it verbatim
 * means what you see is what you configure.
 */
export function formatModelLabel(modelId: string): string {
  return modelId;
}
