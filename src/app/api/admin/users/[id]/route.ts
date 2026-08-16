import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).nullish(),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
  isAdmin: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: RouteContext) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const { name, password, isAdmin } = parsed.data;

  // Refuse self-demotion: an admin removing their own rights could leave the
  // instance with no admin at all, recoverable only via the CLI script.
  if (isAdmin === false && target.id === admin.id) {
    return NextResponse.json(
      { error: "You can't remove your own admin access" },
      { status: 400 },
    );
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(isAdmin !== undefined ? { isAdmin } : {}),
      ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}),
    },
    select: {
      id: true,
      email: true,
      name: true,
      isAdmin: true,
      createdAt: true,
      _count: { select: { conversations: true } },
    },
  });

  const tokens = await prisma.usageEvent.aggregate({
    where: { userId: id },
    _sum: { totalTokens: true },
  });

  return NextResponse.json({
    id: updated.id,
    email: updated.email,
    name: updated.name,
    isAdmin: updated.isAdmin,
    createdAt: updated.createdAt.toISOString(),
    conversationCount: updated._count.conversations,
    tokensUsed: tokens._sum.totalTokens ?? 0,
  });
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (target.id === admin.id) {
    return NextResponse.json({ error: "You can't delete your own account" }, { status: 400 });
  }

  // Their conversations and messages cascade (see prisma/schema.prisma).
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
