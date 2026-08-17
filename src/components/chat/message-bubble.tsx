import { isFileUIPart, isReasoningUIPart, isTextUIPart } from "ai";
import { FileTextIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

import { TypingIndicator } from "@/components/chat/typing-indicator";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import type { ChatUIMessage } from "@/lib/chat-message";
import { cn } from "@/lib/utils";

export function MessageBubble({ message }: { message: ChatUIMessage }) {
  const isUser = message.role === "user";
  const text = message.parts.filter(isTextUIPart).map((p) => p.text).join("");
  const reasoning = message.parts.filter(isReasoningUIPart).map((p) => p.text).join("");
  const images = message.parts.filter(isFileUIPart).filter((p) => p.mediaType.startsWith("image/"));
  const docs = message.parts.filter((p) => p.type === "data-doc").map((p) => p.data);
  const hasAttachments = images.length > 0 || docs.length > 0;

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] space-y-2 rounded-md px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-chat-user text-chat-user-foreground"
            : "bg-chat-ai text-chat-ai-foreground border",
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
        {text ? (
          <div className="prose prose-chat prose-sm dark:prose-invert max-w-none break-words">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                // Web-search answers cite their sources as inline links;
                // opening them in place would throw away the conversation.
                a: ({ ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
              }}
            >
              {text}
            </ReactMarkdown>
          </div>
        ) : (
          !isUser && !hasAttachments && <TypingIndicator />
        )}
      </div>
    </div>
  );
}
