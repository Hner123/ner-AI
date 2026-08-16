import { prisma } from "@/lib/db";

export type UserUsage = {
  totalTokens: number;
  last7Days: number;
  requests: number;
  conversations: number;
  byModel: { model: string; tokens: number }[];
};

/**
 * One person's own token usage. Read from UsageEvent (one row per completed
 * model call) rather than from messages, so deleting a conversation doesn't
 * change the figures.
 */
export async function getUserUsage(userId: string): Promise<UserUsage> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [all, recent, byModel, conversations] = await Promise.all([
    prisma.usageEvent.aggregate({
      where: { userId },
      _sum: { totalTokens: true },
      _count: true,
    }),
    prisma.usageEvent.aggregate({
      where: { userId, createdAt: { gte: weekAgo } },
      _sum: { totalTokens: true },
    }),
    prisma.usageEvent.groupBy({
      by: ["model"],
      where: { userId },
      _sum: { totalTokens: true },
      orderBy: { _sum: { totalTokens: "desc" } },
    }),
    prisma.conversation.count({ where: { userId } }),
  ]);

  return {
    totalTokens: all._sum.totalTokens ?? 0,
    last7Days: recent._sum.totalTokens ?? 0,
    requests: all._count,
    conversations,
    byModel: byModel.map((m) => ({ model: m.model, tokens: m._sum.totalTokens ?? 0 })),
  };
}
