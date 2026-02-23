import { NextRequest, NextResponse } from "next/server";

import { errorResponseFromUnknown } from "../../../../src/lib/http/errors";
import { getHomeSections } from "../../../../src/lib/listings/publicListings";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const sections = await getHomeSections();
    return NextResponse.json({ data: sections });
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}

