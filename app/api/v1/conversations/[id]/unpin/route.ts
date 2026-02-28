import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "../../../../../../src/lib/auth/requireAuth";
import { errorResponseFromUnknown } from "../../../../../../src/lib/http/errors";
import { parseConversationIdParam } from "../../../../../../src/lib/chat/validators";
import { unpinConversationForUser } from "../../../../../../src/lib/chat/service";

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
    const result = await unpinConversationForUser(user, conversationId);
    return NextResponse.json({ data: result });
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}
