import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { requireAdmin } from "../../../../../../../../src/lib/auth/requireAdmin";
import { errorResponseFromUnknown } from "../../../../../../../../src/lib/http/errors";
import { detachMediaFromListing } from "../../../../../../../../src/lib/listings/admin";

export const runtime = "nodejs";

type RouteContext = {
  params: {
    id: string;
    mediaId: string;
  };
};

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAdmin(req);
    await detachMediaFromListing(user, context.params.id, context.params.mediaId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}

