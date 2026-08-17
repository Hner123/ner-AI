"use client";

import type { FileUIPart } from "ai";
import type { DocPart } from "@/lib/chat-message";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Composer } from "@/components/chat/composer";
import { ModelPicker } from "@/components/chat/model-picker";

export function EmptyState({
  allowedModels,
  defaultModel,
}: {
  allowedModels: string[];
  defaultModel: string;
}) {
  const router = useRouter();
  const [model, setModel] = useState(defaultModel);
  const [creating, setCreating] = useState(false);
  const [webSearch, setWebSearch] = useState(false);

  async function handleSend(text: string, files: FileUIPart[], docs: DocPart[]) {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });
      if (!res.ok) {
        toast.error("Could not start a new chat");
        return;
      }
      const conversation = (await res.json()) as { id: string };
      // Stash the first message — the conversation didn't exist yet when it
      // was sent, so ChatWindow picks it up and sends it once mounted. Files
      // are already data: URLs (plain strings) at this point, so JSON-safe.
      sessionStorage.setItem(
        `pending:${conversation.id}`,
        JSON.stringify({ text, files, docs, webSearch }),
      );
      // ?search=1 carries the globe's state into the new conversation.
      router.push(`/chat/${conversation.id}${webSearch ? "?search=1" : ""}`);
      // The sidebar's list comes from the (unchanged) layout above this page
      // — navigating alone won't re-fetch it, so force a refresh too.
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 p-6">
      <h1 className="font-ui text-2xl font-medium tracking-tight">What can I help with?</h1>
      <div className="w-full space-y-3">
        <div className="flex justify-center">
          <ModelPicker models={allowedModels} value={model} onChange={setModel} />
        </div>
        <Composer
          onSend={handleSend}
          disabled={creating}
          placeholder="Message NerKyot…"
          webSearch={webSearch}
          onWebSearchChange={setWebSearch}
        />
      </div>
    </div>
  );
}
