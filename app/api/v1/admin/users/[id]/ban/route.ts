import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "../../../../../../../src/lib/auth/requireAdmin";
import { errorResponseFromUnknown } from "../../../../../../../src/lib/http/errors";
import { readJsonObjectBody } from "../../../../../../../src/lib/listings/admin";
import { banUserAsAdmin } from "../../../../../../../src/lib/moderation/service";
import { parseBanUserInput, parseUserIdParam } from "../../../../../../../src/lib/moderation/validators";

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
    const body = await readJsonObjectBody(req, { code: "INVALID_INPUT" });
    const input = parseBanUserInput(body);
    const result = await banUserAsAdmin(user, targetUserId, input);
    return NextResponse.json({ data: result });
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}
