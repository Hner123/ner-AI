"use client";

import { useCallback, useSyncExternalStore } from "react";

import { DEFAULT_DESIGN, DESIGN_STORAGE_KEY, isDesignId, type DesignId } from "@/lib/designs";

/**
 * Runs before the page paints, so the saved design is already on <html> and
 * there's no flash of the default one. The DOM attribute it sets is the
 * source of truth that useDesign() reads back.
 */
export const designScript = `(function(){try{var d=localStorage.getItem(${JSON.stringify(
  DESIGN_STORAGE_KEY,
)});document.documentElement.dataset.design=d||${JSON.stringify(
  DEFAULT_DESIGN,
)};}catch(e){document.documentElement.dataset.design=${JSON.stringify(DEFAULT_DESIGN)};}})();`;

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function getSnapshot(): DesignId {
  const current = document.documentElement.dataset.design;
  return isDesignId(current) ? current : DEFAULT_DESIGN;
}

/** No DOM on the server; React swaps to the real value after hydration. */
function getServerSnapshot(): DesignId {
  return DEFAULT_DESIGN;
}

/**
 * Reads and writes the active design. The <html> attribute is the store —
 * useSyncExternalStore keeps React in step with it without a setState-in-effect
 * round trip, and the pre-paint script has already applied it by first render.
 */
export function useDesign() {
  const design = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setDesign = useCallback((id: DesignId) => {
    document.documentElement.dataset.design = id;
    try {
      localStorage.setItem(DESIGN_STORAGE_KEY, id);
    } catch {
      // Storage blocked (private mode): the choice still applies to this page
      // view, it just won't be remembered.
    }
    listeners.forEach((notify) => notify());
  }, []);

  return { design, setDesign };
}
