import type { Metadata, Viewport } from "next";
// Self-hosted (no Google CDN request, and it works offline in Docker).
// All four design directions are shipped so they can be switched at runtime;
// a browser only downloads the font files a rendered element actually uses,
// so the inactive directions cost a few KB of CSS and nothing more.
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "@fontsource/newsreader/400.css";
import "@fontsource/newsreader/600.css";
import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/500.css";
import "@fontsource/public-sans/600.css";
import "@fontsource/archivo/400.css";
import "@fontsource/archivo/500.css";
import "@fontsource/archivo/600.css";
import "@fontsource/archivo/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "./globals.css";
import "highlight.js/styles/github-dark.css";

import { designScript } from "@/components/design-provider";
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
      <head>
        {/* Applies the saved design before first paint, so the page never
            flashes the default one first. */}
        <script dangerouslySetInnerHTML={{ __html: designScript }} />
      </head>
      {/* dvh, not vh: on phones the address bar shrinks the viewport, and
          100vh would push the composer below the fold. */}
      <body className="flex h-dvh flex-col overflow-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
