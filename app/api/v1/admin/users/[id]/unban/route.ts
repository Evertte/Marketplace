import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "../../../../../../../src/lib/auth/requireAdmin";
import { errorResponseFromUnknown } from "../../../../../../../src/lib/http/errors";
import { unbanUserAsAdmin } from "../../../../../../../src/lib/moderation/service";
import { parseUserIdParam } from "../../../../../../../src/lib/moderation/validators";

export const runtime = "nodejs";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAdmin(req);
    const targetUserId = parseUserIdParam(context.params.id);
    const result = await unbanUserAsAdmin(user, targetUserId);
    return NextResponse.json({ data: result });
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}
