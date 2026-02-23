import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "../../../../../../../src/lib/auth/requireAdmin";
import { errorResponseFromUnknown } from "../../../../../../../src/lib/http/errors";
import {
  attachMediaToListing,
  readJsonObjectBody,
} from "../../../../../../../src/lib/listings/admin";

export const runtime = "nodejs";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAdmin(req);
    const body = await readJsonObjectBody(req, { code: "INVALID_INPUT" });
    const result = await attachMediaToListing(user, context.params.id, body);
    return NextResponse.json({ data: result });
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}
