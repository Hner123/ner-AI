import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdmin } from "@/lib/admin";
import { listUsersWithUsage } from "@/lib/admin-users";
import { prisma } from "@/lib/db";

export async function GET() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json(await listUsersWithUsage());
}

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().trim().min(1).max(80).optional(),
  isAdmin: z.boolean().optional(),
});

export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const { email, password, name, isAdmin } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "That email is already taken" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await bcrypt.hash(password, 12),
      isAdmin: isAdmin ?? false,
      // The password here was typed by someone else, so it's temporary by
      // definition — the holder is made to replace it at first sign-in.
      mustChangePassword: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      isAdmin: true,
      createdAt: true,
      mustChangePassword: true,
    },
  });

  return NextResponse.json(
    { ...user, createdAt: user.createdAt.toISOString(), conversationCount: 0, tokensUsed: 0 },
    { status: 201 },
  );
}
