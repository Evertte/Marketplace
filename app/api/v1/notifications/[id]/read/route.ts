import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "../../../../../../src/lib/auth/requireAuth";
import { errorResponseFromUnknown } from "../../../../../../src/lib/http/errors";
import { markNotificationReadForUser } from "../../../../../../src/lib/notifications/service";
import { parseNotificationIdParam } from "../../../../../../src/lib/notifications/validators";

export const runtime = "nodejs";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuth(req);
    const notificationId = parseNotificationIdParam(context.params.id);
    const result = await markNotificationReadForUser(user, notificationId);
    return NextResponse.json({ data: result });
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}
