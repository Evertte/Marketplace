import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "../../../../../../../src/lib/auth/requireAdmin";
import { purgeConversationAsAdmin } from "../../../../../../../src/lib/chat/service";
import { parseConversationIdParam } from "../../../../../../../src/lib/chat/validators";
import { errorResponseFromUnknown } from "../../../../../../../src/lib/http/errors";

export const runtime = "nodejs";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAdmin(req);
    const conversationId = parseConversationIdParam(context.params.id);
    const result = await purgeConversationAsAdmin(user, conversationId);
    return NextResponse.json({ data: result });
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}
