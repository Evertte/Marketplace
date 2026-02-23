import { ApiError } from "../http/errors";

export type AdminInquiriesCursor = {
  v: 1;
  sort: "createdAt";
  order: "desc";
  val: string;
  id: string;
};

export function encodeAdminInquiriesCursor(cursor: AdminInquiriesCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeAdminInquiriesCursor(cursor: string): AdminInquiriesCursor {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as Partial<AdminInquiriesCursor>;

    if (
      parsed.v !== 1 ||
      parsed.sort !== "createdAt" ||
      parsed.order !== "desc" ||
      typeof parsed.val !== "string" ||
      typeof parsed.id !== "string" ||
      parsed.id.trim() === ""
    ) {
      throw new Error("Invalid cursor payload");
    }

    return parsed as AdminInquiriesCursor;
  } catch {
    throw new ApiError(400, "INVALID_INPUT", "Invalid cursor");
  }
}

