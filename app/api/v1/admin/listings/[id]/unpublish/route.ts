import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "../../../../../../../src/lib/auth/requireAdmin";
import { errorResponseFromUnknown } from "../../../../../../../src/lib/http/errors";
import { unpublishAdminListing } from "../../../../../../../src/lib/listings/admin";

export const runtime = "nodejs";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAdmin(req);
    const listing = await unpublishAdminListing(user, context.params.id);
    return NextResponse.json({ data: listing });
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}

