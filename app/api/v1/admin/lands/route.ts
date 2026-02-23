import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "../../../../../src/lib/auth/requireAdmin";
import { errorResponseFromUnknown } from "../../../../../src/lib/http/errors";
import { createAdminListing, readJsonObjectBody } from "../../../../../src/lib/listings/admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAdmin(req);
    const body = await readJsonObjectBody(req);
    const listing = await createAdminListing(user, "land", body);
    return NextResponse.json({ data: listing }, { status: 201 });
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}

