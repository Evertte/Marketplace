import { NextRequest, NextResponse } from "next/server";

import { errorResponseFromUnknown } from "../../../../src/lib/http/errors";
import { parsePublicListingsQuery } from "../../../../src/lib/listings/params";
import { listPublicListings } from "../../../../src/lib/listings/publicListings";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const params = parsePublicListingsQuery(req.nextUrl.searchParams);
    const result = await listPublicListings(params);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}

