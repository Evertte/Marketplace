"use client";

import { Suspense } from "react";

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
      <Suspense fallback={<div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Loading conversation...</div>}>
        <MessagesShell selectedConversationId={params.id}>
          <ConversationThread conversationId={params.id} />
        </MessagesShell>
      </Suspense>
    </PublicShell>
  );
}
