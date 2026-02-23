import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "../../../../../src/lib/auth/requireAdmin";
import { errorResponseFromUnknown } from "../../../../../src/lib/http/errors";
import {
  createListingMediaUpload,
  parseMediaPresignInput,
} from "../../../../../src/lib/media/listingMedia";
import { readJsonObjectBody } from "../../../../../src/lib/listings/admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAdmin(req);
    const body = await readJsonObjectBody(req, { code: "INVALID_INPUT" });
    const input = parseMediaPresignInput(body);
    const result = await createListingMediaUpload(user, input);
    return NextResponse.json({ data: result });
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}
