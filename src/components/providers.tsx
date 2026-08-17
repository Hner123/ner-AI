"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

import { PwaRegister } from "@/components/pwa-register";
import { ThemeColorSync } from "@/components/theme-color-sync";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: ReactNode }) {
  return (
    // No background session refetching. Every read of /api/auth/session makes
    // Auth.js re-issue the session cookie, so a refetch landing just after a
    // signout re-mints the token from the copy the browser still holds and
    // leaves the user signed in. Nothing here needs the session to refresh on
    // its own: it's read at mount, and sign-in/out both reload the page.
    <SessionProvider refetchOnWindowFocus={false} refetchWhenOffline={false}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <TooltipProvider delay={200}>
          <ThemeColorSync />
          <PwaRegister />
          {children}
          <Toaster richColors position="top-center" />
        </TooltipProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
