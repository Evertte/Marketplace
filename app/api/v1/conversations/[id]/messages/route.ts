import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "../../../../../../src/lib/auth/requireAuth";
import { listConversationMessagesForUser, createConversationTextMessageForUser } from "../../../../../../src/lib/chat/service";
import {
  parseConversationIdParam,
  parseConversationMessagesListQuery,
  parseCreateTextMessageInput,
} from "../../../../../../src/lib/chat/validators";
import { errorResponseFromUnknown } from "../../../../../../src/lib/http/errors";
import { readJsonObjectBody } from "../../../../../../src/lib/listings/admin";

export const runtime = "nodejs";

type RouteContext = {
  params: {
    id: string;
  };
};

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
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}

