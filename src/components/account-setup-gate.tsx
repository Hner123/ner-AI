import { auth } from "@/auth";
import { AccountSetupDialog } from "@/components/account-setup-dialog";
import { prisma } from "@/lib/db";

/**
 * Renders the setup prompt only when the signed-in account is still on the
 * password an admin issued.
 *
 * Deliberately a server component in the root layout: the decision is made from
 * the database on every render, so the prompt can't be skipped by editing
 * client state, and there's nothing to bypass before hydration.
 */
export async function AccountSetupGate() {
  const session = await auth();
  if (!session?.user) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true, mustChangePassword: true },
  });
  if (!user?.mustChangePassword) return null;

  return <AccountSetupDialog email={user.email} initialName={user.name ?? ""} />;
}
