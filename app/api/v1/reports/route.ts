import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "../../../../src/lib/auth/requireAuth";
import { errorResponseFromUnknown } from "../../../../src/lib/http/errors";
import { readJsonObjectBody } from "../../../../src/lib/listings/admin";
import { createReport } from "../../../../src/lib/moderation/service";
import { parseCreateReportInput } from "../../../../src/lib/moderation/validators";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const body = await readJsonObjectBody(req, { code: "INVALID_INPUT" });
    const input = parseCreateReportInput(body);
    const result = await createReport(user, input);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}
