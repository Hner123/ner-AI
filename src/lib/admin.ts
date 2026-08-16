import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export type AdminUser = { id: string; email: string; isAdmin: boolean };

/**
 * Returns the signed-in user only if they are currently an admin, else null.
 *
 * The `isAdmin` flag is re-read from the database on every call rather than
 * trusted from the session JWT: that token is minted at login, so a user whose
 * admin rights were revoked would keep presenting `isAdmin: true` until their
 * session expired. Every admin API route and page must gate on this.
 */
export async function getAdmin(): Promise<AdminUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, isAdmin: true },
  });

  return user?.isAdmin ? user : null;
}
