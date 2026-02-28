import { NextRequest, NextResponse } from "next/server";

import { ApiError, errorResponseFromUnknown } from "../../../../../src/lib/http/errors";
import { getPublicListingDetailById } from "../../../../../src/lib/listings/publicListings";
import { isUuidLike } from "../../../../../src/lib/listings/params";

export const runtime = "nodejs";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const id = context.params.id;

    if (!isUuidLike(id)) {
      throw new ApiError(404, "NOT_FOUND", "Listing not found");
    }

    const listing = await getPublicListingDetailById(id);
    return NextResponse.json({ data: listing });
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}
