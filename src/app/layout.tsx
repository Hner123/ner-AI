import type { Metadata, Viewport } from "next";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The layout fills the screen and scrolls internally, so let it extend
  // under the phone's rounded corners / notch instead of leaving bars.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      {/* dvh, not vh: on phones the address bar shrinks/expands the viewport,
          and 100vh would push the composer below the fold. */}
      <body className="flex h-dvh flex-col overflow-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
