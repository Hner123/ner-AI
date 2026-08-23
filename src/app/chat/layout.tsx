import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { auth } from "@/auth";
import { MobileNav } from "@/components/chat/mobile-nav";
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
    // Read from the DB, not the session JWT: the token is minted at sign-in, so
    // a revoked admin would keep seeing the link, and a name changed since then
    // (the first-login setup prompt does exactly that) wouldn't show until the
    // next sign-in.
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true, name: true, email: true },
    }),
  ]);

  const sidebarProps = {
    initialConversations: conversations.map((c) => ({
      ...c,
      updatedAt: c.updatedAt.toISOString(),
    })),
    defaultModel: DEFAULT_MODEL,
    user: {
      name: me?.name ?? null,
      email: me?.email ?? session.user.email ?? null,
      isAdmin: me?.isAdmin ?? false,
    },
  };

  return (
    <div className="flex min-h-0 flex-1">
      <Sidebar {...sidebarProps} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <MobileNav {...sidebarProps} />
        {children}
      </div>
    </div>
  );
}
