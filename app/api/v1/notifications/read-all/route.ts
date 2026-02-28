import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "../../../../../src/lib/auth/requireAuth";
import { errorResponseFromUnknown } from "../../../../../src/lib/http/errors";
import { markAllNotificationsReadForUser } from "../../../../../src/lib/notifications/service";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const result = await markAllNotificationsReadForUser(user);
    return NextResponse.json({ data: result });
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}
