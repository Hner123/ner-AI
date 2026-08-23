import type { MetadataRoute } from "next";

/**
 * Makes the app installable to a phone's home screen: its own icon, launched
 * without browser chrome. There's no separate mobile codebase — the responsive
 * layout already here is the app.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "NerKyot",
    short_name: "NerKyot",
    description: "Chat with your GDS AI Gateway",
    // "/" rather than "/chat": it already redirects by session, so a launch
    // lands on the login screen or the chat list as appropriate.
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Splash-screen colour. Static by necessity, so it's the default
    // (Familiar light) — the live chrome colour is updated per design at
    // runtime by ThemeColorSync.
    background_color: "#ffffff",
    theme_color: "#ffffff",
    orientation: "any",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Inset further, so Android can crop to a circle/squircle without
      // clipping the mark.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "New chat",
        short_name: "New chat",
        url: "/chat",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
