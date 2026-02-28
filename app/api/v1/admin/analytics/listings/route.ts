import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "../../../../../../src/lib/auth/requireAdmin";
import { getAnalyticsListings } from "../../../../../../src/lib/analytics/service";
import { parseAnalyticsListingsQuery } from "../../../../../../src/lib/analytics/validators";
import { errorResponseFromUnknown } from "../../../../../../src/lib/http/errors";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const query = parseAnalyticsListingsQuery(req.nextUrl.searchParams);
    const result = await getAnalyticsListings(query);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}
