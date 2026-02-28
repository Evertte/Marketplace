import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "../../../../../src/lib/auth/requireAdmin";
import { errorResponseFromUnknown } from "../../../../../src/lib/http/errors";
import { listAdminReports } from "../../../../../src/lib/moderation/service";
import { parseAdminReportsQuery } from "../../../../../src/lib/moderation/validators";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAdmin(req);
    const query = parseAdminReportsQuery(req.nextUrl.searchParams);
    const result = await listAdminReports(user, query);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}
