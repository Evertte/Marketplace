import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "../../../../../../src/lib/auth/requireAuth";
import { broadcastConversationReadUpdated } from "../../../../../../src/lib/chat/broadcast";
import { markConversationReadForUser } from "../../../../../../src/lib/chat/service";
import { parseConversationIdParam } from "../../../../../../src/lib/chat/validators";
import { errorResponseFromUnknown } from "../../../../../../src/lib/http/errors";

export const runtime = "nodejs";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuth(req);
    const conversationId = parseConversationIdParam(context.params.id);
    const result = await markConversationReadForUser(user, conversationId);
    await broadcastConversationReadUpdated({
      conversationId: result.conversationId,
      userId: result.userId,
      lastReadMessageId: result.lastReadMessageId,
      lastReadAt: result.lastReadAt,
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}
