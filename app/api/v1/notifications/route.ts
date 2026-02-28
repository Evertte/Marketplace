import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "../../../../src/lib/auth/requireAuth";
import { errorResponseFromUnknown } from "../../../../src/lib/http/errors";
import { listNotificationsForUser } from "../../../../src/lib/notifications/service";
import { parseNotificationsListQuery } from "../../../../src/lib/notifications/validators";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const query = parseNotificationsListQuery(req.nextUrl.searchParams);
    const result = await listNotificationsForUser(user, query);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}
