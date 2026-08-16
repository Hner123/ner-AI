import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { DEFAULT_MODEL, isAllowedModel } from "@/lib/gateway";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversations = await prisma.conversation.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, model: true, updatedAt: true },
  });
  return NextResponse.json(conversations);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const requestedModel = typeof body?.model === "string" ? body.model : undefined;
  const model = requestedModel && isAllowedModel(requestedModel) ? requestedModel : DEFAULT_MODEL;

  const conversation = await prisma.conversation.create({
    data: { userId: session.user.id, model },
  });
  return NextResponse.json(conversation, { status: 201 });
}
