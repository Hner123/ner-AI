"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOutIcon, MoreHorizontalIcon, PlusIcon, SettingsIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export type ConversationSummary = {
  id: string;
  title: string;
  model: string;
  updatedAt: string;
};

export type SidebarUser = { name: string | null; email: string | null; isAdmin: boolean };

/**
 * The sidebar's contents, without the surrounding column. Rendered twice: as a
 * fixed column on desktop, and inside a drawer on mobile (see mobile-nav.tsx).
 * `onNavigate` lets the drawer close itself when a link is followed.
 */
export function SidebarContent({
  initialConversations,
  defaultModel,
  user,
  onNavigate,
}: {
  initialConversations: ConversationSummary[];
  defaultModel: string;
  user: SidebarUser;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [conversations, setConversations] = useState(initialConversations);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  // `initialConversations` only changes when router.refresh() re-runs the
  // server layout (new chat created elsewhere, title/order updated after a
  // reply) — useState's initializer won't pick that up on its own, so sync
  // explicitly whenever a fresh prop arrives.
  useEffect(() => {
    // Deliberate: re-syncing local (optimistically-editable) state to a fresh server prop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConversations(initialConversations);
  }, [initialConversations]);

  async function newChat() {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: defaultModel }),
      });
      if (!res.ok) {
        toast.error("Could not start a new chat");
        return;
      }
      const conversation = (await res.json()) as ConversationSummary;
      setConversations((prev) => [conversation, ...prev]);
      router.push(`/chat/${conversation.id}`);
      router.refresh();
      onNavigate?.();
    } finally {
      setCreating(false);
    }
  }

  async function deleteConversation(id: string) {
    if (!window.confirm("Delete this chat? This can't be undone.")) return;
    const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not delete chat");
      return;
    }
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (pathname === `/chat/${id}`) router.push("/chat");
    router.refresh();
  }

  function startRename(c: ConversationSummary) {
    setEditingId(c.id);
    setEditingTitle(c.title);
  }

  async function saveRename(id: string) {
    const title = editingTitle.trim();
    setEditingId(null);
    if (!title) return;
    const res = await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
      router.refresh();
    } else {
      toast.error("Could not rename chat");
    }
  }

  return (
    <>
      <div className="p-3">
        <Button
          onClick={newChat}
          disabled={creating}
          variant="outline"
          className="w-full justify-start gap-2 font-ui"
        >
          <PlusIcon className="size-4" />
          New chat
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-2">
        <nav className="flex flex-col gap-0.5 pb-2">
          {conversations.map((c) => {
            const active = pathname === `/chat/${c.id}`;
            return (
              <div
                key={c.id}
                className={cn(
                  "group hover:bg-sidebar-accent relative flex items-center rounded-md",
                  active && "bg-sidebar-accent",
                )}
              >
                {editingId === c.id ? (
                  <input
                    autoFocus
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onBlur={() => saveRename(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename(c.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="w-full bg-transparent px-2 py-1.5 font-ui text-[13px] outline-none"
                  />
                ) : (
                  <Link
                    href={`/chat/${c.id}`}
                    onClick={onNavigate}
                    className="min-w-0 flex-1 truncate px-2 py-1.5 font-ui text-[13px]"
                  >
                    {c.title}
                  </Link>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Options for ${c.title}`}
                        // Always visible on touch screens — there is no hover
                        // there, so hiding it would make rename/delete
                        // unreachable on a phone.
                        className="mr-1 shrink-0 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                      >
                        <MoreHorizontalIcon className="size-3.5" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => startRename(c)}>Rename</DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => deleteConversation(c.id)}>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="border-sidebar-border flex items-center gap-2 border-t p-3">
        {/* Everyone gets Settings — it holds the appearance choice. Admins
            reach user management from there. */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Settings"
          render={<Link href="/settings" onClick={onNavigate} />}
        >
          <SettingsIcon className="size-4" />
        </Button>
        <Avatar size="sm">
          <AvatarFallback className="bg-brand text-brand-foreground font-ui text-xs font-semibold">
            {(user.name ?? user.email ?? "?").slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <p className="min-w-0 flex-1 truncate font-ui text-[13px] font-medium">
          {user.name ?? user.email}
        </p>
        <ThemeToggle />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Sign out"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOutIcon className="size-4" />
        </Button>
      </div>
    </>
  );
}

/** The desktop sidebar: a fixed column, hidden below the md breakpoint. */
export function Sidebar(props: {
  initialConversations: ConversationSummary[];
  defaultModel: string;
  user: SidebarUser;
}) {
  return (
    <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border hidden w-64 shrink-0 flex-col border-r md:flex">
      <SidebarContent {...props} />
    </aside>
  );
}
