import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "../../../../../src/lib/auth/requireAdmin";
import { errorResponseFromUnknown } from "../../../../../src/lib/http/errors";
import {
  confirmListingMediaUpload,
  parseMediaConfirmInput,
} from "../../../../../src/lib/media/listingMedia";
import { readJsonObjectBody } from "../../../../../src/lib/listings/admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await readJsonObjectBody(req, { code: "INVALID_INPUT" });
    const { mediaId } = parseMediaConfirmInput(body);
    const result = await confirmListingMediaUpload(mediaId);
    return NextResponse.json({ data: result });
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}
