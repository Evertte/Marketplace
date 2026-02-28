import { NextRequest, NextResponse } from "next/server";

import { recordListingView, resolveListingVisitorHash } from "../../../../../../src/lib/analytics/service";
import { errorResponseFromUnknown } from "../../../../../../src/lib/http/errors";
import { isUuidLike } from "../../../../../../src/lib/listings/params";

export const runtime = "nodejs";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const id = context.params.id;
    if (!isUuidLike(id)) {
      return NextResponse.json({ data: { tracked: false } });
    }

    const visitorHash = await resolveListingVisitorHash(req);
    const result = await recordListingView({
      listingId: id,
      visitorHash,
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}
