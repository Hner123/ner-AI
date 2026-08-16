import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { auth } from "@/auth";
import { Sidebar } from "@/components/chat/sidebar";
import { prisma } from "@/lib/db";
import { DEFAULT_MODEL } from "@/lib/gateway";

export default async function ChatLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [conversations, me] = await Promise.all([
    prisma.conversation.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, model: true, updatedAt: true },
    }),
    // Read the flag from the DB, not the session JWT, so a revoked admin
    // stops seeing the link without having to sign out first.
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    }),
  ]);

  return (
    <div className="flex min-h-0 flex-1">
      <Sidebar
        initialConversations={conversations.map((c) => ({
          ...c,
          updatedAt: c.updatedAt.toISOString(),
        }))}
        defaultModel={DEFAULT_MODEL}
        user={{
          name: session.user.name ?? null,
          email: session.user.email ?? null,
          isAdmin: me?.isAdmin ?? false,
        }}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
