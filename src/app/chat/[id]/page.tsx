import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { ChatWindow } from "@/components/chat/chat-window";
import { prisma } from "@/lib/db";
import { ALLOWED_MODELS } from "@/lib/gateway";
import { dbMessageToUIMessage } from "@/lib/messages";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) notFound();

  const conversation = await prisma.conversation.findFirst({
    where: { id, userId: session.user.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) notFound();

  return (
    // key forces a fresh ChatWindow (and useChat instance) per conversation —
    // navigating between /chat/[id] routes reuses the component otherwise.
    <ChatWindow
      key={conversation.id}
      conversationId={conversation.id}
      title={conversation.title}
      model={conversation.model}
      allowedModels={ALLOWED_MODELS}
      initialMessages={conversation.messages.map(dbMessageToUIMessage)}
    />
  );
}
