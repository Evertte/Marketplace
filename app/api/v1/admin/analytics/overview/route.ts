import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "../../../../../../src/lib/auth/requireAdmin";
import { getAnalyticsOverview } from "../../../../../../src/lib/analytics/service";
import { parseAnalyticsDateRange } from "../../../../../../src/lib/analytics/validators";
import { errorResponseFromUnknown } from "../../../../../../src/lib/http/errors";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const range = parseAnalyticsDateRange(req.nextUrl.searchParams);
    const result = await getAnalyticsOverview(range);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}
