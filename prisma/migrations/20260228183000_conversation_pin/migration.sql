-- AlterTable
ALTER TABLE "ConversationParticipant" ADD COLUMN "pinnedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ConversationParticipant_userId_pinnedAt_idx" ON "ConversationParticipant"("userId", "pinnedAt");
