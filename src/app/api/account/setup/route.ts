import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

const schema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().trim().min(1, "Please enter a name").max(80).optional(),
});

/**
 * Completes a handed-over account: the holder replaces the password their admin
 * chose, and optionally sets the name shown next to their avatar.
 *
 * The account it updates comes from the session, never from the request body —
 * otherwise this would be an endpoint for setting anyone's password.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const { password, name } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Reusing the issued password would leave the admin knowing it, which is the
  // one thing this flow exists to prevent.
  if (await bcrypt.compare(password, user.passwordHash)) {
    return NextResponse.json(
      { error: "Please choose a different password from the one you were given" },
      { status: 400 },
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      passwordHash: await bcrypt.hash(password, 12),
      mustChangePassword: false,
      ...(name ? { name } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
