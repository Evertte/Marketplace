import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "../../../../../src/lib/auth/requireAdmin";
import { errorResponseFromUnknown } from "../../../../../src/lib/http/errors";
import {
  listAdminListings,
  parseAdminListingsQuery,
} from "../../../../../src/lib/listings/admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAdmin(req);
    const query = parseAdminListingsQuery(req.nextUrl.searchParams);
    const result = await listAdminListings(user, query);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}

