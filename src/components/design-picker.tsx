"use client";

import { CheckIcon } from "lucide-react";

import { useDesign } from "@/components/design-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { DESIGNS } from "@/lib/designs";
import { cn } from "@/lib/utils";

export function DesignPicker() {
  const { design, setDesign } = useDesign();

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-ui text-sm font-medium tracking-wide uppercase">Appearance</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Applies to this browser only — everyone picks their own.
          </p>
        </div>
        <ThemeToggle />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {DESIGNS.map((d) => {
          const active = d.id === design;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => setDesign(d.id)}
              aria-pressed={active}
              className={cn(
                "group focus-visible:ring-ring relative rounded-md border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
                active ? "border-brand bg-accent/40" : "hover:bg-accent/40",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {/* Each card is set in its own typeface, so the choice
                        shows you what you're picking. */}
                    <span style={{ fontFamily: d.preview }} className="text-base font-medium">
                      {d.name}
                    </span>
                    <span className="text-muted-foreground text-xs">{d.tagline}</span>
                  </div>
                  <p
                    style={{ fontFamily: d.preview }}
                    className="text-muted-foreground mt-1 text-sm"
                  >
                    {d.description}
                  </p>
                  <p className="text-muted-foreground mt-2 text-[11px]">{d.fonts}</p>
                </div>
                {active && (
                  <span className="bg-brand text-brand-foreground flex size-5 shrink-0 items-center justify-center rounded-full">
                    <CheckIcon className="size-3" />
                  </span>
                )}
              </div>

              <div className="mt-3 flex gap-1.5" aria-hidden="true">
                {d.swatches.map((s) => (
                  <span
                    key={s}
                    style={{ background: s }}
                    className="border-border size-6 rounded-sm border"
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
