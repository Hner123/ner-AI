import { ArrowLeftIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DesignPicker } from "@/components/design-picker";
import { UsageSummary } from "@/components/usage-summary";
import { Button } from "@/components/ui/button";
import { getAdmin } from "@/lib/admin";
import { getUserUsage } from "@/lib/usage";

/** Open to every signed-in user, though only appearance is shown to everyone —
 *  token usage is admin-only. */
export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const admin = await getAdmin();
  // Fetched only for admins, rather than fetched-then-hidden: a member has no
  // use for it and shouldn't pay for the query either.
  const usage = admin ? await getUserUsage(session.user.id) : null;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mb-6 space-y-3">
        <Link
          href="/chat"
          className="text-muted-foreground hover:text-foreground font-ui inline-flex items-center gap-1.5 text-xs"
        >
          <ArrowLeftIcon className="size-4" />
          Back to chat
        </Link>
        <div>
          <h1 className="font-ui text-2xl font-medium tracking-tight">Settings</h1>
          <p className="text-muted-foreground font-data text-xs">
            Signed in as {session.user.email}
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {usage && <UsageSummary usage={usage} />}
        <DesignPicker />
      </div>

      {admin && (
        <div className="mt-8 border-t pt-6">
          <h2 className="font-ui text-sm font-medium tracking-wide uppercase">Administration</h2>
          <p className="text-muted-foreground mt-1 mb-3 text-sm">
            Add people, set passwords, and see token usage across the shared gateway key.
          </p>
          <Button variant="outline" className="gap-2" render={<Link href="/admin" />}>
            <UsersIcon className="size-4" />
            Manage users
          </Button>
        </div>
      )}
    </main>
  );
}
