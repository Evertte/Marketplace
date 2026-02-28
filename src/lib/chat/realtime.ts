export const CONVERSATION_MESSAGE_NEW_EVENT = "message:new";
export const CONVERSATION_ACTIVITY_EVENT = "conversation:activity";

export type ConversationMessageBroadcastPayload = {
  conversationId: string;
  messageId: string;
  createdAt: string;
};

export type ConversationActivityDetail = {
  conversationId: string;
};

export function getConversationRealtimeTopic(conversationId: string): string {
  return `conversation:${conversationId}`;
}

export function emitConversationActivity(conversationId: string): void {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<ConversationActivityDetail>(CONVERSATION_ACTIVITY_EVENT, {
      detail: { conversationId },
    }),
  );
}
