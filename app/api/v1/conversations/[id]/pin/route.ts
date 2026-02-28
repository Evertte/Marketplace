import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "../../../../../../src/lib/auth/requireAuth";
import { errorResponseFromUnknown } from "../../../../../../src/lib/http/errors";
import { pinConversationForUser } from "../../../../../../src/lib/chat/service";
import { parseConversationIdParam } from "../../../../../../src/lib/chat/validators";

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
    const result = await pinConversationForUser(user, conversationId);
    return NextResponse.json({ data: result });
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}
