-- Files the assistant produces (xlsx/docx). Bytes are stored in-row: there's
-- no object storage in this deployment, and a download link in an old
-- conversation has to keep working.
CREATE TABLE "GeneratedFile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedFile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GeneratedFile_conversationId_createdAt_idx"
    ON "GeneratedFile"("conversationId", "createdAt");

ALTER TABLE "GeneratedFile" ADD CONSTRAINT "GeneratedFile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GeneratedFile" ADD CONSTRAINT "GeneratedFile_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
