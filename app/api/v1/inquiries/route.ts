import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "../../../../src/lib/auth/requireAuth";
import { errorResponseFromUnknown } from "../../../../src/lib/http/errors";
import { createInquiryAndAutoConversation } from "../../../../src/lib/inquiries/service";
import { parseCreateInquiryInput } from "../../../../src/lib/inquiries/validators";
import { readJsonObjectBody } from "../../../../src/lib/listings/admin";
import { createNotificationAndBroadcast } from "../../../../src/lib/notifications/service";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const body = await readJsonObjectBody(req, { code: "INVALID_INPUT" });
    const input = parseCreateInquiryInput(body);
    const result = await createInquiryAndAutoConversation(user, input);
    await createNotificationAndBroadcast({
      userId: result.sellerUserId,
      type: "NEW_INQUIRY",
      title: "New inquiry",
      body: "Someone is interested in your listing",
      href: `/admin/inquiries`,
      data: {
        listingId: result.listing_id,
        inquiryId: result.inquiry_id,
        conversationId: result.conversation_id,
        },
    });

    return NextResponse.json(
      {
        data: {
          inquiry_id: result.inquiry_id,
          conversation_id: result.conversation_id,
          listing_id: result.listing_id,
          created: result.created,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}
