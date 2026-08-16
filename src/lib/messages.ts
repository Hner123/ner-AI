import { isFileUIPart, isTextUIPart, type FileUIPart, type UIMessage } from "ai";

import type { ChatUIMessage } from "@/lib/chat-message";
import type { Message as DbMessage } from "@/generated/prisma/client";

/** Non-text parts (images + document data parts) as stored on Message.attachments. */
type StoredParts = ChatUIMessage["parts"];

export function dbMessageToUIMessage(msg: DbMessage): ChatUIMessage {
  const stored = (msg.attachments as StoredParts | null) ?? [];
  const parts: StoredParts = [...stored];
  if (msg.content) parts.push({ type: "text", text: msg.content });
  return {
    id: msg.id,
    role: msg.role as ChatUIMessage["role"],
    parts,
  };
}

/** Concatenate every text part of a message — ignores reasoning/file/data parts. */
export function uiMessageText(message: Pick<UIMessage, "parts">): string {
  return message.parts.filter(isTextUIPart).map((p) => p.text).join("");
}

/** Every file (image) part of a message. */
export function uiMessageFileParts(message: Pick<UIMessage, "parts">): FileUIPart[] {
  return message.parts.filter(isFileUIPart);
}

/**
 * The parts worth persisting alongside the plain text: images and attached
 * documents. Text lives in Message.content; transient parts (step markers,
 * reasoning) are dropped.
 */
export function persistableParts(message: Pick<ChatUIMessage, "parts">): StoredParts {
  return message.parts.filter((p) => p.type === "file" || p.type === "data-doc");
}

/** Read a File as a data: URL and shape it as an AI SDK FileUIPart. */
export function fileToFileUIPart(file: File): Promise<FileUIPart> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        type: "file",
        mediaType: file.type,
        filename: file.name,
        url: reader.result as string,
      });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
