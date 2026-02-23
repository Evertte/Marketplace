import { ApiError } from "../http/errors";

export type ConversationsCursor = {
  v: 1;
  sort: "activity";
  order: "desc";
  lastMessageAt: string | null;
  createdAt: string;
  id: string;
};

export type ConversationMessagesCursor = {
  v: 1;
  sort: "createdAt";
  order: "desc";
  val: string;
  id: string;
};

export function encodeConversationsCursor(cursor: ConversationsCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeConversationsCursor(cursor: string): ConversationsCursor {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as Partial<ConversationsCursor>;

    if (
      parsed.v !== 1 ||
      parsed.sort !== "activity" ||
      parsed.order !== "desc" ||
      typeof parsed.createdAt !== "string" ||
      typeof parsed.id !== "string" ||
      (parsed.lastMessageAt !== null && typeof parsed.lastMessageAt !== "string")
    ) {
      throw new Error("Invalid cursor");
    }

    return parsed as ConversationsCursor;
  } catch {
    throw new ApiError(400, "INVALID_INPUT", "Invalid cursor");
  }
}

export function encodeConversationMessagesCursor(
  cursor: ConversationMessagesCursor,
): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeConversationMessagesCursor(
  cursor: string,
): ConversationMessagesCursor {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as Partial<ConversationMessagesCursor>;

    if (
      parsed.v !== 1 ||
      parsed.sort !== "createdAt" ||
      parsed.order !== "desc" ||
      typeof parsed.val !== "string" ||
      typeof parsed.id !== "string" ||
      parsed.id.trim() === ""
    ) {
      throw new Error("Invalid cursor");
    }

    return parsed as ConversationMessagesCursor;
  } catch {
    throw new ApiError(400, "INVALID_INPUT", "Invalid cursor");
  }
}

