import { ApiError } from "../http/errors";

export type PublicListingsCursorSort = "publishedAt" | "price";
export type PublicListingsCursorOrder = "asc" | "desc";

export type PublicListingsCursor = {
  v: 1;
  sort: PublicListingsCursorSort;
  order: PublicListingsCursorOrder;
  val: string;
  id: string;
};

export function encodeListingsCursor(cursor: PublicListingsCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeListingsCursor(cursor: string): PublicListingsCursor {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as Partial<PublicListingsCursor>;

    if (
      parsed.v !== 1 ||
      (parsed.sort !== "publishedAt" && parsed.sort !== "price") ||
      (parsed.order !== "asc" && parsed.order !== "desc") ||
      typeof parsed.val !== "string" ||
      typeof parsed.id !== "string" ||
      !parsed.id
    ) {
      throw new Error("Invalid cursor payload");
    }

    return parsed as PublicListingsCursor;
  } catch {
    throw new ApiError(400, "INVALID_QUERY_PARAMS", "Invalid cursor");
  }
}

