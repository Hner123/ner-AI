import type { UIMessage } from "ai";

/**
 * A document the user attached. The extracted text travels as a data part so
 * the bubble can render a compact chip while the model still receives the full
 * contents (see convertDataPart in src/app/api/chat/route.ts).
 */
export type DocPart = {
  filename: string;
  mediaType: string;
  text: string;
  chars: number;
  truncated: boolean;
};

export type ChatUIMessage = UIMessage<never, { doc: DocPart }>;
