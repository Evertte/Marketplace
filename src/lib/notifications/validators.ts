import { z } from "zod";

import { ApiError } from "../http/errors";
import { decodeNotificationsCursor, type NotificationsCursor } from "./cursor";

export type NotificationsListQuery = {
  limit: number;
  cursor?: NotificationsCursor;
};

const cuidSchema = z.string().cuid();

function parseLimit(raw: string | null): number {
  if (!raw || raw.trim() === "") return 20;
  if (!/^\d+$/.test(raw.trim())) {
    throw new ApiError(400, "INVALID_INPUT", "Invalid limit");
  }
  const limit = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(limit) || limit < 1) {
    throw new ApiError(400, "INVALID_INPUT", "Invalid limit");
  }
  return Math.min(limit, 50);
}

export function parseNotificationsListQuery(searchParams: URLSearchParams): NotificationsListQuery {
  const limit = parseLimit(searchParams.get("limit"));
  const cursorRaw = searchParams.get("cursor")?.trim() || undefined;
  const cursor = cursorRaw ? decodeNotificationsCursor(cursorRaw) : undefined;
  if (cursor && Number.isNaN(Date.parse(cursor.val))) {
    throw new ApiError(400, "INVALID_INPUT", "Invalid cursor");
  }
  return {
    limit,
    ...(cursor ? { cursor } : {}),
  };
}

export function parseNotificationIdParam(value: string): string {
  const parsed = cuidSchema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError(404, "NOT_FOUND", "Notification not found");
  }
  return parsed.data;
}
