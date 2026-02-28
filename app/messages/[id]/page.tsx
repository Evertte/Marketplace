"use client";

import { ConversationThread } from "@/src/components/messages/conversation-thread";
import { MessagesShell } from "@/src/components/messages/messages-shell";
import { PublicShell } from "@/src/components/site/public-shell";

export default function MessagesConversationPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <PublicShell
      title="Messages"
      subtitle="Live conversation updates with persisted message history."
    >
      <MessagesShell selectedConversationId={params.id}>
        <ConversationThread conversationId={params.id} />
      </MessagesShell>
    </PublicShell>
  );
}
