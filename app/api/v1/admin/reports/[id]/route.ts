import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "../../../../../../src/lib/auth/requireAdmin";
import { errorResponseFromUnknown } from "../../../../../../src/lib/http/errors";
import { readJsonObjectBody } from "../../../../../../src/lib/listings/admin";
import { getAdminReportDetail, updateAdminReport } from "../../../../../../src/lib/moderation/service";
import { parseReportIdParam, parseUpdateReportInput } from "../../../../../../src/lib/moderation/validators";

export const runtime = "nodejs";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAdmin(req);
    const reportId = parseReportIdParam(context.params.id);
    const result = await getAdminReportDetail(user, reportId);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAdmin(req);
    const reportId = parseReportIdParam(context.params.id);
    const body = await readJsonObjectBody(req, { code: "INVALID_INPUT" });
    const input = parseUpdateReportInput(body);
    const result = await updateAdminReport(user, reportId, input);
    return NextResponse.json({ data: result });
  } catch (error) {
    return errorResponseFromUnknown(req, error);
  }
}
