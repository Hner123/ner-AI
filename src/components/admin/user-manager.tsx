"use client";

import { KeyRoundIcon, PlusIcon, ShieldIcon, Trash2Icon, UserIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { AdminUserRow } from "@/lib/admin-users";

export type { AdminUserRow };

const nf = new Intl.NumberFormat("en-US");

export function UserManager({
  initialUsers,
  currentUserId,
}: {
  initialUsers: AdminUserRow[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [addOpen, setAddOpen] = useState(false);
  const [resetFor, setResetFor] = useState<AdminUserRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggleAdmin(user: AdminUserRow) {
    setBusyId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAdmin: !user.isAdmin }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not update user");
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === user.id ? data : u)));
      toast.success(data.isAdmin ? `${data.email} is now an admin` : `${data.email} is no longer an admin`);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteUser(user: AdminUserRow) {
    const warning =
      user.conversationCount > 0
        ? `\n\nThis also permanently deletes their ${user.conversationCount} conversation(s).`
        : "";
    if (!window.confirm(`Delete ${user.email}?${warning}\n\nThis can't be undone.`)) return;

    setBusyId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not delete user");
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      toast.success(`Deleted ${user.email}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-ui text-sm font-medium tracking-wide uppercase">Users</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            <span className="font-data tabular-nums">{users.length}</span> account
            {users.length === 1 ? "" : "s"} ·{" "}
            <span className="font-data tabular-nums">
              {nf.format(users.reduce((sum, u) => sum + u.tokensUsed, 0))}
            </span>{" "}
            tokens used in total · everyone shares the same gateway key
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="w-full gap-1.5 sm:w-auto">
          <PlusIcon className="size-4" />
          Add user
        </Button>
      </div>

      {/* The table can't compress below ~640px without the action buttons
          colliding, so on a phone it scrolls sideways inside its own box
          rather than forcing the whole page to scroll. */}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-muted-foreground font-ui text-[11px] tracking-wider uppercase">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">User</th>
              <th className="px-4 py-2.5 text-left font-medium">Role</th>
              <th className="px-4 py-2.5 text-right font-medium">Tokens</th>
              <th className="px-4 py-2.5 text-right font-medium">Chats</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <tr key={u.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-md">
                        <UserIcon className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {u.name ?? u.email}
                          {isSelf && <span className="text-muted-foreground font-normal"> (you)</span>}
                        </div>
                        <div className="text-muted-foreground truncate font-data text-xs">
                          {u.email}
                        </div>
                        {u.mustChangePassword && (
                          // Worth surfacing: this account is still on the
                          // password you typed, so you can still sign in as them.
                          <div className="text-muted-foreground mt-0.5 font-ui text-[11px]">
                            Hasn&apos;t set their own password yet
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {u.isAdmin ? (
                      <span className="bg-brand/15 text-brand inline-flex items-center gap-1 rounded-sm px-2 py-0.5 font-ui text-[11px] font-medium tracking-wide uppercase">
                        <ShieldIcon className="size-3" />
                        Admin
                      </span>
                    ) : (
                      <span className="text-muted-foreground font-ui text-[11px] tracking-wide uppercase">
                        Member
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-data text-[13px] tabular-nums">
                    {u.tokensUsed > 0 ? (
                      nf.format(u.tokensUsed)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-right font-data text-xs tabular-nums">
                    {u.conversationCount}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busyId === u.id}
                        onClick={() => setResetFor(u)}
                        className="gap-1.5"
                      >
                        <KeyRoundIcon className="size-3.5" />
                        Password
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busyId === u.id || isSelf}
                        title={isSelf ? "You can't change your own admin access" : undefined}
                        onClick={() => toggleAdmin(u)}
                      >
                        {u.isAdmin ? "Make member" : "Make admin"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={busyId === u.id || isSelf}
                        title={isSelf ? "You can't delete your own account" : "Delete user"}
                        aria-label={`Delete ${u.email}`}
                        onClick={() => deleteUser(u)}
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AddUserDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={(user) => setUsers((prev) => [...prev, user])}
      />
      <ResetPasswordDialog user={resetFor} onOpenChange={(open) => !open && setResetFor(null)} />
    </div>
  );
}

function AddUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (user: AdminUserRow) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: name || undefined, isAdmin }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not create user");
        return;
      }
      onCreated({ ...data, conversationCount: 0 });
      toast.success(`Created ${data.email}`);
      setEmail("");
      setName("");
      setPassword("");
      setIsAdmin(false);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-email">Email</Label>
            <Input
              id="new-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-name">Name (optional)</Label>
            <Input id="new-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-password">Password</Label>
            <Input
              id="new-password"
              type="text"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              At least 8 characters. Share it with them — they can&apos;t reset it themselves.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
              className="size-4"
            />
            Make this user an admin
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create user"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  user,
  onOpenChange,
}: {
  user: AdminUserRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not set password");
        return;
      }
      toast.success(`Password updated for ${user.email}`);
      setPassword("");
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={user !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set password</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">
            New password for <span className="text-foreground font-medium">{user?.email}</span>. Their
            existing sessions stay signed in.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reset-password">New password</Label>
            <Input
              id="reset-password"
              type="text"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Set password"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
