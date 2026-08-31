import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/**
 * Serves a file the assistant generated.
 *
 * Scoped to the owner: the id is a cuid rather than a guessable number, but
 * that alone isn't authorisation — a link pasted into a group chat would
 * otherwise hand over whatever the spreadsheet contains.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const file = await prisma.generatedFile.findFirst({
    where: { id, userId: session.user.id },
  });
  // 404 rather than 403 for someone else's file: whether an id exists is
  // itself information.
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "content-type": file.mediaType,
      // Images are displayed in the conversation, so they must be served
      // inline — "attachment" is right for a spreadsheet but would stop an
      // <img> from ever showing one.
      "content-disposition": `${file.mediaType.startsWith("image/") ? "inline" : "attachment"}; filename="${file.filename}"`,
      "content-length": String(file.size),
      "cache-control": "private, max-age=31536000, immutable",
    },
  });
}
