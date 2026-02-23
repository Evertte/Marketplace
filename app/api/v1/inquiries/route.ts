import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "../../../../src/lib/auth/requireAuth";
import { errorResponseFromUnknown } from "../../../../src/lib/http/errors";
import { createInquiryAndAutoConversation } from "../../../../src/lib/inquiries/service";
import { parseCreateInquiryInput } from "../../../../src/lib/inquiries/validators";
import { readJsonObjectBody } from "../../../../src/lib/listings/admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const body = await readJsonObjectBody(req, { code: "INVALID_INPUT" });
    const input = parseCreateInquiryInput(body);
    const result = await createInquiryAndAutoConversation(user, input);

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}

