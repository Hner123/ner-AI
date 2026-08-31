import { prisma } from "@/lib/db";

/**
 * The gateway keeps a generated image for 24 hours (GENERATED_IMAGE_TTL_SECONDS)
 * and serves it from its own /v1/images/<id>.png. That's fine while the reply is
 * on screen, but a conversation reopened next week would show a broken image, so
 * the bytes are copied into this app's own storage and the link rewritten.
 *
 * Failure is not fatal: if the copy doesn't work the original link is kept, and
 * a picture that works for a day beats no picture at all.
 */
const GATEWAY_IMAGE = /!\[([^\]]*)\]\((https?:\/\/[^)\s]+\/v1\/images\/[A-Za-z0-9]+\.png)\)/g;

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export async function persistGatewayImages(
  text: string,
  { userId, conversationId }: { userId: string; conversationId: string },
): Promise<string> {
  const base = (process.env.GDS_GATEWAY_URL ?? "").replace(/\/+$/, "");
  if (!base || !text.includes("/v1/images/")) return text;

  const seen = new Map<string, string>();
  const matches = [...text.matchAll(GATEWAY_IMAGE)].filter((m) => m[2].startsWith(base));

  for (const [, alt, url] of matches) {
    if (seen.has(url)) continue;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) continue;
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) continue;

      const row = await prisma.generatedFile.create({
        data: {
          userId,
          conversationId,
          filename: `${(alt || "image").replace(/[^\w-]/g, "-").slice(0, 40) || "image"}.png`,
          mediaType: "image/png",
          size: bytes.byteLength,
          data: bytes,
        },
        select: { id: true },
      });
      seen.set(url, `/api/files/${row.id}`);
    } catch {
      // Network hiccup or a link that has already expired — keep the original.
    }
  }

  let out = text;
  for (const [from, to] of seen) out = out.split(from).join(to);
  return out;
}
