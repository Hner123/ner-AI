"use client";

import { MenuIcon } from "lucide-react";
import { useState } from "react";

import {
  SidebarContent,
  type ConversationSummary,
  type SidebarUser,
} from "@/components/chat/sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/**
 * Mobile-only top bar. Below the md breakpoint the sidebar column is hidden,
 * so this provides the way back to it — the same content in a drawer, which
 * closes itself whenever a link inside is followed.
 */
export function MobileNav({
  initialConversations,
  defaultModel,
  user,
}: {
  initialConversations: ConversationSummary[];
  defaultModel: string;
  user: SidebarUser;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-sidebar flex items-center gap-2 border-b px-2 py-2 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="Open chats">
              <MenuIcon className="size-5" />
            </Button>
          }
        />
        <SheetContent
          side="left"
          showCloseButton={false}
          className="bg-sidebar text-sidebar-foreground w-[86%] max-w-xs gap-0 p-0"
        >
          <SheetTitle className="sr-only">Chats</SheetTitle>
          <SidebarContent
            initialConversations={initialConversations}
            defaultModel={defaultModel}
            user={user}
            onNavigate={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
      <span className="font-ui text-sm font-medium">NerKyot</span>
    </div>
  );
}
