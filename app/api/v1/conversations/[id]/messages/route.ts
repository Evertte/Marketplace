import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "../../../../../../src/lib/auth/requireAuth";
import {
  CONVERSATION_MESSAGE_NEW_EVENT,
  getConversationRealtimeTopic,
} from "../../../../../../src/lib/chat/realtime";
import { listConversationMessagesForUser, createConversationTextMessageForUser } from "../../../../../../src/lib/chat/service";
import {
  parseConversationIdParam,
  parseConversationMessagesListQuery,
  parseCreateTextMessageInput,
} from "../../../../../../src/lib/chat/validators";
import { errorResponseFromUnknown } from "../../../../../../src/lib/http/errors";
import { readJsonObjectBody } from "../../../../../../src/lib/listings/admin";
import { getSupabaseAdmin } from "../../../../../../src/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = {
  params: {
    id: string;
  };
};

async function broadcastMessageCreated(args: {
  conversationId: string;
  messageId: string;
  createdAt: string;
}) {
  try {
    const supabase = getSupabaseAdmin();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (!serviceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
    }

    await supabase.realtime.setAuth(serviceRoleKey);
    const channel = supabase.channel(getConversationRealtimeTopic(args.conversationId), {
      config: { private: true },
    });
    await channel.httpSend(CONVERSATION_MESSAGE_NEW_EVENT, args);
    void supabase.removeChannel(channel);
  } catch (error) {
    console.error("Failed to broadcast new message", error);
  }
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuth(req);
    const conversationId = parseConversationIdParam(context.params.id);
    const query = parseConversationMessagesListQuery(req.nextUrl.searchParams);
    const result = await listConversationMessagesForUser(user, conversationId, query);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuth(req);
    const conversationId = parseConversationIdParam(context.params.id);
    const body = await readJsonObjectBody(req, { code: "INVALID_INPUT" });
    const input = parseCreateTextMessageInput(body);
    const result = await createConversationTextMessageForUser(user, conversationId, input);
    await broadcastMessageCreated({
      conversationId,
      messageId: result.message_id,
      createdAt: result.createdAt,
    });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}
