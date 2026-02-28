import "server-only";

import {
  CONVERSATION_MESSAGE_NEW_EVENT,
  CONVERSATION_READ_UPDATED_EVENT,
  getConversationRealtimeTopic,
  type ConversationMessageBroadcastPayload,
  type ConversationReadStateBroadcastPayload,
} from "./realtime";
import { getSupabaseAdmin } from "../supabase/server";

async function broadcastConversationEvent(
  conversationId: string,
  event: string,
  payload: ConversationMessageBroadcastPayload | ConversationReadStateBroadcastPayload,
) {
  try {
    const supabase = getSupabaseAdmin();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (!serviceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
    }

    await supabase.realtime.setAuth(serviceRoleKey);
    const channel = supabase.channel(getConversationRealtimeTopic(conversationId), {
      config: { private: true },
    });
    await channel.httpSend(event, payload);
    void supabase.removeChannel(channel);
  } catch (error) {
    console.error(`Failed to broadcast ${event}`, error);
  }
}

export async function broadcastConversationMessageCreated(
  payload: ConversationMessageBroadcastPayload,
) {
  await broadcastConversationEvent(
    payload.conversationId,
    CONVERSATION_MESSAGE_NEW_EVENT,
    payload,
  );
}

export async function broadcastConversationReadUpdated(
  payload: ConversationReadStateBroadcastPayload,
) {
  await broadcastConversationEvent(
    payload.conversationId,
    CONVERSATION_READ_UPDATED_EVENT,
    payload,
  );
}
