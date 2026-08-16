import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { UserManager } from "@/components/admin/user-manager";
import { getAdmin } from "@/lib/admin";
import { listUsersWithUsage } from "@/lib/admin-users";

export default async function AdminPage() {
  const admin = await getAdmin();
  // 404 rather than a redirect so a non-admin can't tell the page exists.
  if (!admin) notFound();

  const users = await listUsersWithUsage();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 overflow-y-auto p-6">
      <div className="mb-6 space-y-3">
        <Link
          href="/chat"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 font-mono text-xs"
        >
          <ArrowLeftIcon className="size-4" />
          Back to chat
        </Link>
        <div>
          <h1 className="font-mono text-2xl font-medium tracking-tight">Settings</h1>
          <p className="text-muted-foreground font-mono text-xs">Signed in as {admin.email}</p>
        </div>
      </div>

      <UserManager currentUserId={admin.id} initialUsers={users} />
    </main>
  );
}
