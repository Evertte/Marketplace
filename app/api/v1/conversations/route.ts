import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "../../../../src/lib/auth/requireAuth";
import { errorResponseFromUnknown } from "../../../../src/lib/http/errors";
import { listUserConversations } from "../../../../src/lib/chat/service";
import { parseConversationsListQuery } from "../../../../src/lib/chat/validators";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const query = parseConversationsListQuery(req.nextUrl.searchParams);
    const result = await listUserConversations(user, query);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}

