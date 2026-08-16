import type { Metadata } from "next";
// Self-hosted (no Google CDN request, and it works offline in Docker).
// IBM Plex Mono carries the interface chrome; IBM Plex Sans sets message text.
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./globals.css";
import "highlight.js/styles/github-dark.css";

import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "NerKyot",
  description: "Chat with your GDS AI Gateway",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <body className="flex h-full flex-col overflow-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
