import { NextRequest, NextResponse } from "next/server";

import { errorResponseFromUnknown } from "../../../../src/lib/http/errors";
import { getHomeSections } from "../../../../src/lib/listings/publicListings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const sections = await getHomeSections();
    return NextResponse.json(
      { data: sections },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}
