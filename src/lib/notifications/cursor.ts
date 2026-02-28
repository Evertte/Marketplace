import { ApiError } from "../http/errors";

type NotificationsCursor = {
  v: 1;
  sort: "createdAt";
  order: "desc";
  val: string;
  id: string;
};

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function encodeNotificationsCursor(cursor: NotificationsCursor): string {
  return encodeBase64Url(JSON.stringify(cursor));
}

export function decodeNotificationsCursor(raw: string): NotificationsCursor {
  try {
    const parsed = JSON.parse(decodeBase64Url(raw)) as NotificationsCursor;
    if (
      parsed?.v !== 1 ||
      parsed.sort !== "createdAt" ||
      parsed.order !== "desc" ||
      typeof parsed.val !== "string" ||
      typeof parsed.id !== "string"
    ) {
      throw new Error("Invalid cursor");
    }
    return parsed;
  } catch {
    throw new ApiError(400, "INVALID_INPUT", "Invalid cursor");
  }
}

export type { NotificationsCursor };
