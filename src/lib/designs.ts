/**
 * The interface looks a user can choose between. Palettes live in globals.css;
 * `preview` is repeated here so each card in the picker can render its own
 * typeface rather than the currently-active one.
 */
export const DESIGNS = [
  {
    id: "console",
    name: "Console",
    tagline: "Terminal heritage",
    description: "Monospace chrome, amber accent, tight corners.",
    fonts: "IBM Plex Mono · IBM Plex Sans",
    preview: '"IBM Plex Mono", ui-monospace, monospace',
    swatches: ["#0d1117", "#161b22", "#e3a008", "#e6edf3"],
  },
  {
    id: "reader",
    name: "Reader",
    tagline: "Replies as prose",
    description: "Serif answers at a comfortable reading size, forest green.",
    fonts: "Newsreader · Public Sans",
    preview: '"Newsreader", ui-serif, Georgia, serif',
    swatches: ["#f8f9f7", "#ffffff", "#2f5d50", "#1a1f1c"],
  },
  {
    id: "precision",
    name: "Precision",
    tagline: "Swiss utility",
    description: "Nothing rounded, signal red, figures in tabular columns.",
    fonts: "Archivo · JetBrains Mono",
    preview: '"Archivo", ui-sans-serif, system-ui, sans-serif',
    swatches: ["#ffffff", "#f4f4f5", "#d62828", "#0a0a0a"],
  },
  {
    id: "cushion",
    name: "Cushion",
    tagline: "Soft product",
    description: "Generous corners, cushioned surfaces, muted teal.",
    fonts: "Manrope",
    preview: '"Manrope", ui-sans-serif, system-ui, sans-serif',
    swatches: ["#f4f6f8", "#ffffff", "#2e8b84", "#1b2430"],
  },
] as const;

export type DesignId = (typeof DESIGNS)[number]["id"];

export const DEFAULT_DESIGN: DesignId = "console";
export const DESIGN_STORAGE_KEY = "nerkyot-design";

export function isDesignId(value: unknown): value is DesignId {
  return DESIGNS.some((d) => d.id === value);
}
