import type { NextRequest } from "next/server";

import { ApiError } from "../http/errors";
import { requireAuth } from "./requireAuth";

export async function requireAdmin(req: NextRequest) {
  const result = await requireAuth(req);

  if (result.user.role !== "admin") {
    throw new ApiError(403, "FORBIDDEN", "Admin access required");
  }

  return result;
}
