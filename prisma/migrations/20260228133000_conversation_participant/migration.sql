-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "id" TEXT NOT NULL,
    "conversationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_userId_key" ON "ConversationParticipant"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "ConversationParticipant_userId_archivedAt_idx" ON "ConversationParticipant"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "ConversationParticipant_conversationId_idx" ON "ConversationParticipant"("conversationId");

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing conversations
INSERT INTO "ConversationParticipant" ("id", "conversationId", "userId", "role", "createdAt", "updatedAt")
SELECT
  concat('cp_', replace(gen_random_uuid()::text, '-', '')),
  c."id",
  c."buyerUserId",
  'buyer',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Conversation" c
ON CONFLICT ("conversationId", "userId") DO NOTHING;

INSERT INTO "ConversationParticipant" ("id", "conversationId", "userId", "role", "createdAt", "updatedAt")
SELECT
  concat('cp_', replace(gen_random_uuid()::text, '-', '')),
  c."id",
  c."sellerUserId",
  'seller',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Conversation" c
ON CONFLICT ("conversationId", "userId") DO NOTHING;
