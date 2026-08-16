import { EmptyState } from "@/components/chat/empty-state";
import { ALLOWED_MODELS, DEFAULT_MODEL } from "@/lib/gateway";

export default function ChatIndexPage() {
  return <EmptyState allowedModels={ALLOWED_MODELS} defaultModel={DEFAULT_MODEL} />;
}
