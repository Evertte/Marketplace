import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "../../../../../src/lib/auth/requireAdmin";
import { errorResponseFromUnknown } from "../../../../../src/lib/http/errors";
import { listAdminInquiries } from "../../../../../src/lib/inquiries/service";
import { parseAdminInquiriesQuery } from "../../../../../src/lib/inquiries/validators";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAdmin(req);
    const query = parseAdminInquiriesQuery(req.nextUrl.searchParams);
    const result = await listAdminInquiries(user, query);

    return NextResponse.json(result);
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}

