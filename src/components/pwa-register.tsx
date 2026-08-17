"use client";

import { useEffect } from "react";

/**
 * Registers the service worker, which is what makes Chrome on Android offer a
 * real install rather than a bookmark. See public/sw.js — it caches nothing.
 *
 * Registration needs a secure context, so this is a no-op over plain HTTP
 * (localhost excepted). In production the app sits behind Caddy's TLS.
 */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Not fatal — the app works exactly the same, it just won't offer to
        // install on Android.
      });
    };
    // After load: registering during startup competes with the app's own
    // requests for connections.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
