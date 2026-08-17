import { convertToModelMessages, streamText } from "ai";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import type { Prisma } from "@/generated/prisma/client";
import type { ChatUIMessage, DocPart } from "@/lib/chat-message";
import { prisma } from "@/lib/db";
import { gatewayFor } from "@/lib/gateway";
import { persistableParts, uiMessageFileParts, uiMessageText } from "@/lib/messages";

export async function POST(req: Request) {
  // Captured once, up front — used to stamp the assistant reply's createdAt
  // below. Using `now()` at INSERT time (the default) would instead stamp it
  // whenever `onFinish` happens to complete, which can lag arbitrarily behind
  // (retries, a slow model, or the user sending more messages before a
  // pending reply resolves) and sort the reply after newer messages that
  // were actually sent later — it must render right after the turn that
  // prompted it, not whenever generation happened to finish.
  const requestStartedAt = new Date();

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { id?: string; messages?: ChatUIMessage[]; webSearch?: boolean }
    | null;
  const conversationId = body?.id;
  const messages = body?.messages;
  const webSearch = body?.webSearch === true;
  if (!conversationId || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId: session.user.id },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  // The client always sends the full message list; persist the new user turn
  // (its UIMessage id doubles as the Message row's id, so re-sends no-op).
  const lastMessage = messages[messages.length - 1];
  if (lastMessage.role === "user") {
    const attachments = persistableParts(lastMessage);
    await prisma.message.upsert({
      where: { id: lastMessage.id },
      create: {
        id: lastMessage.id,
        conversationId,
        role: "user",
        content: uiMessageText(lastMessage),
        // Plain JSON-serialisable parts; Prisma's InputJsonValue can't infer
        // that from the AI SDK's part union.
        attachments: attachments.length
          ? (attachments as unknown as Prisma.InputJsonValue)
          : undefined,
        createdAt: requestStartedAt,
      },
      update: {},
    });
  }

  const firstUserMessage = messages.find((m) => m.role === "user");
  const titleCandidate = firstUserMessage
    ? uiMessageText(firstUserMessage).trim().slice(0, 80) ||
      (uiMessageFileParts(firstUserMessage).length ? "Image" : undefined) ||
      firstUserMessage.parts.find((p) => p.type === "data-doc")?.data.filename
    : undefined;

  const modelMessages = await convertToModelMessages(messages, {
    // Attached documents ride along as `data-doc` parts so the UI can show a
    // compact chip; the model needs their actual contents, so expand them
    // into text here.
    convertDataPart: (part) => {
      if (part.type !== "data-doc") return undefined;
      const doc = part.data as DocPart;
      const note = doc.truncated ? " (truncated)" : "";
      return {
        type: "text",
        text: `Attached file: ${doc.filename}${note}\n\n${doc.text}`,
      };
    },
  });

  const userId = session.user.id;

  const result = streamText({
    model: gatewayFor(webSearch)(conversation.model),
    messages: modelMessages,
    // Token accounting is recorded per USER (not per conversation) so totals
    // survive someone deleting their chats — see the UsageEvent model.
    onFinish: async ({ usage }) => {
      const inputTokens = usage.inputTokens ?? 0;
      const outputTokens = usage.outputTokens ?? 0;
      const totalTokens = usage.totalTokens ?? inputTokens + outputTokens;
      if (totalTokens === 0) return;
      try {
        await prisma.usageEvent.create({
          data: { userId, model: conversation.model, inputTokens, outputTokens, totalTokens },
        });
      } catch (err) {
        // Usage tracking must never break a reply that already streamed fine.
        console.error("[usage] failed to record UsageEvent:", err);
      }
    },
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    // REQUIRED for persistence: without this the SDK leaves the response
    // message's id EMPTY, so every assistant reply upserts onto the same ""
    // primary key — each new reply overwrites the previous one's row (keeping
    // that row's original createdAt), which looks like replies vanishing and
    // like new replies sorting into an old position.
    generateMessageId: () => randomUUID(),
    // The gateway's error messages (budget/rate-limit/model-whitelist) are
    // meant to be shown to the caller — the SDK hides error details from the
    // client by default ("An error occurred.") to avoid leaking internal
    // exceptions, which isn't the right default for our own gateway's errors.
    onError: (error) => (error instanceof Error ? error.message : "Something went wrong."),
    onFinish: async ({ responseMessage }) => {
      const text = uiMessageText(responseMessage);
      if (text.trim() && responseMessage.id) {
        await prisma.message.upsert({
          where: { id: responseMessage.id },
          create: {
            id: responseMessage.id,
            conversationId,
            role: "assistant",
            content: text,
            // +1ms so it always sorts right after the turn's user message,
            // regardless of how long generation actually took (see the note
            // on requestStartedAt above).
            createdAt: new Date(requestStartedAt.getTime() + 1),
          },
          update: { content: text },
        });
      }
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          updatedAt: new Date(),
          ...(conversation.title === "New chat" && titleCandidate
            ? { title: titleCandidate }
            : {}),
        },
      });
    },
  });
}
