import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "../../../../../../src/lib/auth/requireAdmin";
import { errorResponseFromUnknown } from "../../../../../../src/lib/http/errors";
import {
  getAdminListingDetail,
  readJsonObjectBody,
  updateAdminListing,
} from "../../../../../../src/lib/listings/admin";

export const runtime = "nodejs";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAdmin(req);
    const body = await readJsonObjectBody(req);
    const listing = await updateAdminListing(user, context.params.id, body);
    return NextResponse.json({ data: listing });
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAdmin(req);
    const listing = await getAdminListingDetail(user, context.params.id);
    return NextResponse.json({ data: listing });
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}
