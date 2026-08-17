"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type FileUIPart } from "ai";
import { RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Composer } from "@/components/chat/composer";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ModelPicker } from "@/components/chat/model-picker";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import type { ChatUIMessage, DocPart } from "@/lib/chat-message";

export function ChatWindow({
  conversationId,
  title,
  model,
  allowedModels,
  initialMessages,
  initialWebSearch = false,
}: {
  conversationId: string;
  title: string;
  model: string;
  allowedModels: string[];
  initialMessages: ChatUIMessage[];
  initialWebSearch?: boolean;
}) {
  const router = useRouter();
  const [currentModel, setCurrentModel] = useState(model);
  const [webSearch, setWebSearch] = useState(initialWebSearch);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, stop, regenerate, error } = useChat<ChatUIMessage>({
    id: conversationId,
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onError: (err) => toast.error(err.message || "Something went wrong"),
    // The server auto-titles the conversation (and bumps its recency) once
    // the reply finishes — refresh so the sidebar picks that up.
    onFinish: () => router.refresh(),
  });

  function handleSend(
    text: string,
    files: FileUIPart[],
    docs: DocPart[],
    searchOverride?: boolean,
  ) {
    // Built as explicit parts (rather than sendMessage's text/files shorthand)
    // so attached documents can travel as data parts alongside the text.
    const parts: ChatUIMessage["parts"] = [
      ...files,
      ...docs.map((doc) => ({ type: "data-doc" as const, data: doc })),
    ];
    if (text) parts.push({ type: "text", text });
    if (parts.length === 0) return;
    // Per-request, not per-conversation: the route reads this to decide whether
    // to enable the gateway's hosted web search for this turn only.
    sendMessage({ parts }, { body: { webSearch: searchOverride ?? webSearch } });
  }

  // The empty-state composer creates the conversation, stashes the first
  // message (no conversation existed yet to send it to), then navigates here.
  useEffect(() => {
    const key = `pending:${conversationId}`;
    const raw = sessionStorage.getItem(key);
    if (raw) {
      sessionStorage.removeItem(key);
      try {
        const {
          text,
          files,
          docs,
          webSearch: pendingWebSearch,
        } = JSON.parse(raw) as {
          text: string;
          files: FileUIPart[];
          docs?: DocPart[];
          webSearch?: boolean;
        };
        // The toggle itself carries over via ?search=1 (initialWebSearch); this
        // first send predates that state, so the flag is passed explicitly.
        handleSend(text, files ?? [], docs ?? [], pendingWebSearch ?? false);
      } catch {
        // malformed payload — nothing to recover, drop it silently
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const streaming = status === "submitted" || status === "streaming";
  const canChangeModel = messages.length === 0;
  const showPendingBubble =
    status === "submitted" && messages[messages.length - 1]?.role !== "assistant";

  async function changeModel(next: string) {
    setCurrentModel(next);
    await fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: next }),
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 border-b p-3">
        <h1 className="min-w-0 truncate font-ui text-[13px] font-medium">{title}</h1>
        <ModelPicker
          models={allowedModels}
          value={currentModel}
          onChange={changeModel}
          disabled={!canChangeModel}
        />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4">
          {messages.map((m, i) => (
            <MessageBubble
              key={m.id}
              message={m}
              // Regeneration replaces the newest reply; offering it on an older
              // one would strand every turn recorded after it.
              onRegenerate={
                m.role === "assistant" && i === messages.length - 1 && !streaming
                  ? () => void regenerate()
                  : undefined
              }
              busy={streaming}
            />
          ))}
          {showPendingBubble && (
            // The request is in flight but no assistant message exists yet, so
            // there's no bubble to hold a typing indicator — without this, the
            // gap between hitting send and the stream opening shows nothing.
            // Once the stream's `start` chunk arrives the SDK pushes an empty
            // assistant message (while status is still "submitted"), and that
            // message's own bubble renders the indicator instead — hence the
            // lastMessage check, or both would show at once.
            <div className="flex justify-start">
              <div className="bg-chat-ai max-w-[85%] rounded-md border px-4 py-2.5">
                <TypingIndicator />
              </div>
            </div>
          )}
          {error && !streaming && (
            // A failed turn leaves no assistant bubble to hang a retry off, and
            // the error toast is long gone by the time anyone reacts to it.
            <div className="flex items-center gap-2 self-start rounded-md border border-dashed px-3 py-2">
              <span className="text-muted-foreground text-xs">That reply didn&apos;t go through.</span>
              <button
                type="button"
                onClick={() => void regenerate()}
                className="font-ui text-brand inline-flex items-center gap-1 text-xs font-medium hover:underline"
              >
                <RefreshCwIcon className="size-3" />
                Try again
              </button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl p-4">
        <Composer
          onSend={handleSend}
          onStop={stop}
          disabled={streaming}
          streaming={streaming}
          placeholder="Message NerKyot…"
          webSearch={webSearch}
          onWebSearchChange={setWebSearch}
        />
      </div>
    </div>
  );
}
