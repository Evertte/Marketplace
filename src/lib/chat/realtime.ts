export const CONVERSATION_MESSAGE_NEW_EVENT = "message:new";
export const CONVERSATION_READ_UPDATED_EVENT = "read-updated";
export const CONVERSATION_ACTIVITY_EVENT = "conversation:activity";
export const USER_NOTIFICATION_EVENT = "notification";

export type ConversationMessageBroadcastPayload = {
  conversationId: string;
  messageId: string;
  createdAt: string;
};

export type ConversationReadStateBroadcastPayload = {
  conversationId: string;
  userId: string;
  lastReadMessageId: string | null;
  lastReadAt: string | null;
};

export type ConversationActivityDetail = {
  conversationId: string;
};

export type UserNotificationBroadcastPayload = {
  id: string;
  userId: string;
  type: "NEW_MESSAGE" | "NEW_INQUIRY" | "LISTING_PUBLISHED" | "SYSTEM";
  title: string;
  body: string | null;
  href: string | null;
  data: unknown;
  readAt: string | null;
  createdAt: string;
};

export function getConversationRealtimeTopic(conversationId: string): string {
  return `conversation:${conversationId}`;
}

export function getUserNotificationRealtimeTopic(userId: string): string {
  return `user-${userId}`;
}

export function emitConversationActivity(conversationId: string): void {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<ConversationActivityDetail>(CONVERSATION_ACTIVITY_EVENT, {
      detail: { conversationId },
    }),
  );
}
