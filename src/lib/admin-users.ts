import { prisma } from "@/lib/db";

export type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
  /** Still on the password the admin issued. */
  mustChangePassword: boolean;
  createdAt: string;
  conversationCount: number;
  tokensUsed: number;
};

/**
 * Every account plus its lifetime token usage, shaped for the admin table.
 * Usage is summed from UsageEvent (one row per completed model call) rather
 * than from messages, so it doesn't reset when someone deletes their chats.
 */
export async function listUsersWithUsage(): Promise<AdminUserRow[]> {
  const [users, usage] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true,
        mustChangePassword: true,
        createdAt: true,
        _count: { select: { conversations: true } },
      },
    }),
    prisma.usageEvent.groupBy({
      by: ["userId"],
      _sum: { totalTokens: true },
    }),
  ]);

  const tokensByUser = new Map(usage.map((u) => [u.userId, u._sum.totalTokens ?? 0]));

  return users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    isAdmin: u.isAdmin,
    mustChangePassword: u.mustChangePassword,
    createdAt: u.createdAt.toISOString(),
    conversationCount: u._count.conversations,
    tokensUsed: tokensByUser.get(u.id) ?? 0,
  }));
}
