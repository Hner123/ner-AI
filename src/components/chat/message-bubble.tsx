import { isFileUIPart, isReasoningUIPart, isTextUIPart } from "ai";
import { CheckIcon, FileDownIcon, FileTextIcon, PencilIcon, RefreshCwIcon, XIcon } from "lucide-react";
import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

import { CodeBlock } from "@/components/chat/code-block";
import { CopyButton } from "@/components/chat/copy-button";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import type { ChatUIMessage } from "@/lib/chat-message";
import { cn } from "@/lib/utils";

export function MessageBubble({
  message,
  onRegenerate,
  onEdit,
  busy,
}: {
  message: ChatUIMessage;
  /** Only passed for the latest assistant reply — regenerating an older one
   *  would orphan every turn that came after it. */
  onRegenerate?: () => void;
  /** Rewrites this turn and re-asks from here. Everything after it goes, so
   *  the caller warns before calling this on anything but the last turn. */
  onEdit?: (text: string) => void;
  busy?: boolean;
}) {
  const isUser = message.role === "user";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const text = message.parts.filter(isTextUIPart).map((p) => p.text).join("");
  const reasoning = message.parts.filter(isReasoningUIPart).map((p) => p.text).join("");
  const images = message.parts.filter(isFileUIPart).filter((p) => p.mediaType.startsWith("image/"));
  const docs = message.parts.filter((p) => p.type === "data-doc").map((p) => p.data);
  const hasAttachments = images.length > 0 || docs.length > 0;

  return (
    <div className={cn("group/msg flex flex-col", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] space-y-2 rounded-md px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-chat-user text-chat-user-foreground"
            : "bg-chat-ai text-chat-ai-foreground border",
          // While editing, take the full width allowed. A bubble sized to a
          // short message leaves a slot too narrow to reword anything in.
          editing && "w-full",
        )}
      >
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((img, i) => (
              <Dialog key={i}>
                <DialogTrigger className="block cursor-zoom-in rounded-lg p-0 outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {/* eslint-disable-next-line @next/next/no-img-element -- data: URL, not an optimizable asset */}
                  <img
                    src={img.url}
                    loading="lazy"
                    alt={img.filename ?? "attached image"}
                    className="h-48 max-w-full rounded-lg object-contain"
                  />
                </DialogTrigger>
                <DialogContent
                  showCloseButton
                  className="max-w-[calc(100%-2rem)] border-none bg-transparent p-0 shadow-none ring-0 sm:max-w-3xl"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- data: URL, not an optimizable asset */}
                  <img
                    src={img.url}
                    loading="lazy"
                    alt={img.filename ?? "attached image"}
                    className="max-h-[85vh] w-full rounded-lg object-contain"
                  />
                </DialogContent>
              </Dialog>
            ))}
          </div>
        )}
        {docs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {docs.map((doc, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-2.5 py-2",
                  isUser ? "border-chat-user-foreground/25" : "border-border bg-background/50",
                )}
              >
                <FileTextIcon className="size-4 shrink-0 opacity-70" />
                <div className="min-w-0 font-ui">
                  <div className="max-w-48 truncate text-xs font-medium">{doc.filename}</div>
                  <div className="text-[11px] tabular-nums opacity-70">
                    {doc.truncated ? "truncated · " : ""}
                    {doc.chars.toLocaleString()} chars
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {!isUser && reasoning && (
          <p className="text-muted-foreground border-muted-foreground/30 border-l-2 pl-2 text-xs italic">
            {reasoning}
          </p>
        )}
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends, Shift+Enter breaks the line — the same bargain
                // the composer makes, so editing feels like typing it again.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (draft.trim()) {
                    setEditing(false);
                    onEdit?.(draft.trim());
                  }
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setEditing(false);
                }
              }}
              // Counting newlines alone clipped anything that merely WRAPPED:
              // a one-line message that spills over three visual lines still
              // reported one row. The length estimate covers wrapping, and
              // field-sizing-content lets the browser do it exactly where
              // supported.
              rows={Math.min(
                Math.max(draft.split(/\r?\n/).length, Math.ceil(draft.length / 52), 2),
                12,
              )}
              autoFocus
              aria-label="Edit your message"
              className="ring-chat-user-foreground/30 focus:ring-chat-user-foreground/60 field-sizing-content max-h-72 w-full resize-y rounded-md bg-black/15 p-2 text-sm outline-none ring-1 focus:ring-2"
            />
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="inline-flex items-center gap-1 rounded px-2 py-1 font-ui text-xs opacity-80 hover:bg-black/15 hover:opacity-100"
              >
                <XIcon className="size-3.5" />
                Cancel
              </button>
              <button
                type="button"
                disabled={!draft.trim()}
                onClick={() => {
                  setEditing(false);
                  onEdit?.(draft.trim());
                }}
                className="bg-chat-user-foreground/15 hover:bg-chat-user-foreground/25 inline-flex items-center gap-1 rounded px-2 py-1 font-ui text-xs font-medium disabled:opacity-40"
              >
                <CheckIcon className="size-3.5" />
                Send
              </button>
            </div>
          </div>
        ) : text ? (
          <MessageMarkdown text={text} />
        ) : (
          !isUser && !hasAttachments && <TypingIndicator />
        )}
      </div>

      {isUser && text && !editing && (
        <div className="pointer-events-none mt-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/msg:pointer-events-auto group-hover/msg:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100 max-md:pointer-events-auto max-md:opacity-100">
          <CopyButton getText={() => text} label="Copy message" />
          {onEdit && (
            <button
              type="button"
              onClick={() => {
                setDraft(text);
                setEditing(true);
              }}
              disabled={busy}
              aria-label="Edit message"
              title="Edit and ask again"
              className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex items-center rounded p-1 transition-colors disabled:opacity-40"
            >
              <PencilIcon className="size-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Actions sit under the bubble, revealed on hover — but kept in the DOM
          so they stay reachable by keyboard and on touch, where hover never
          fires. Only for finished assistant replies. */}
      {!isUser && text && (
        <div className="pointer-events-none mt-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/msg:pointer-events-auto group-hover/msg:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100 max-md:pointer-events-auto max-md:opacity-100">
          <CopyButton getText={() => text} label="Copy reply" />
          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={busy}
              aria-label="Regenerate reply"
              title="Regenerate reply"
              className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex items-center rounded p-1 transition-colors disabled:opacity-40"
            >
              <RefreshCwIcon className="size-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Stream updates and action callbacks must not reparse unchanged Markdown.
export const MessageMarkdown = memo(function MessageMarkdown({ text }: { text: string }) {
  return (
          <div className="prose prose-chat prose-sm dark:prose-invert max-w-none break-words">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                a: ({ href, children, ...props }) => {
                  // A generated file reads as something to download, not as a
                  // sentence to click through — and it must not open in a new
                  // tab, or the browser flashes a blank window before the
                  // attachment starts.
                  if (href?.startsWith("/api/files/")) {
                    return (
                      <a
                        href={href}
                        download
                        className="border-border bg-background hover:bg-muted my-1 inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 no-underline transition-colors"
                        {...props}
                      >
                        <FileDownIcon className="text-muted-foreground size-4 shrink-0" />
                        <span className="font-ui text-xs font-medium">{children}</span>
                      </a>
                    );
                  }
                  // Web-search answers cite their sources as inline links;
                  // opening them in place would throw away the conversation.
                  return <a href={href} {...props} target="_blank" rel="noopener noreferrer">{children}</a>;
                },
                pre: CodeBlock,
                // Generated images arrive as ordinary markdown. Left to the
                // default they render at intrinsic size and blow the bubble
                // out; the anchor gives a way to see one full size.
                img: ({ src, alt }) =>
                  typeof src === "string" ? (
                    <a href={src} target="_blank" rel="noopener noreferrer" className="block no-underline">
                      {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary remote/stored URL, nothing for next/image to optimise */}
                      <img
                        src={src}
                        alt={alt ?? "generated image"}
                        loading="lazy"
                        className="border-border my-1 max-h-[28rem] w-auto max-w-full rounded-md border"
                      />
                    </a>
                  ) : null,
              }}
            >
              {text}
            </ReactMarkdown>
          </div>
  );
});
