"use client";

import { useRef, type ComponentPropsWithoutRef } from "react";

import { CopyButton } from "@/components/chat/copy-button";
import { cn } from "@/lib/utils";

/**
 * A <pre> from the markdown renderer with its own copy button. The text is
 * read off the DOM node at click time, so it copies exactly what's on screen —
 * without the syntax highlighter's markup, and without re-deriving it from the
 * message source.
 */
export function CodeBlock({ children, className, ...props }: ComponentPropsWithoutRef<"pre">) {
  const ref = useRef<HTMLPreElement>(null);

  return (
    <div className="group/code relative">
      {/* Reserve room for the button: on a one-line snippet it would otherwise
          sit directly on top of the code. */}
      <pre ref={ref} className={cn("pr-12", className)} {...props}>
        {children}
      </pre>
      <CopyButton
        getText={() => ref.current?.innerText ?? ""}
        label="Copy code"
        // pointer-events-none while hidden: the button sits over the code, and
        // an invisible-but-clickable target would swallow clicks and text
        // selection in that corner.
        className="bg-background/80 pointer-events-none absolute top-2 right-2 opacity-0 backdrop-blur transition-opacity group-hover/code:pointer-events-auto group-hover/code:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100"
      />
    </div>
  );
}
