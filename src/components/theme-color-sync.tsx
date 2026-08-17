"use client";

import { useEffect } from "react";

/**
 * Keeps <meta name="theme-color"> matching the live background.
 *
 * Installed to a home screen, that colour is what the OS paints around the app
 * — the status bar area on Android, the notch surround on iOS. The manifest's
 * theme_color is a single static value, which would be wrong for seven of the
 * eight combinations of four designs and light/dark.
 *
 * Watching the <html> attributes rather than hooking into either system means
 * this stays correct no matter how the design or theme is changed, including
 * next-themes reacting to the OS switching to dark on its own.
 */
export function ThemeColorSync() {
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }

    const sync = () => {
      const bg = getComputedStyle(document.body).backgroundColor;
      // Skip transparent: reported before the stylesheet resolves, and it would
      // make the surround render as black.
      if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
        meta.setAttribute("content", bg);
      }
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-design"],
    });
    return () => observer.disconnect();
  }, []);

  return null;
}
