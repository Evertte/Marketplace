import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "../../../../src/lib/auth/requireAuth";
import { errorResponseFromUnknown } from "../../../../src/lib/http/errors";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);

    return NextResponse.json({
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}

