import { z } from "zod";

import { ApiError } from "../http/errors";
import {
  decodeConversationMessagesCursor,
  decodeConversationsCursor,
  type ConversationMessagesCursor,
  type ConversationsCursor,
} from "./cursor";

export type ConversationsListQuery = {
  limit: number;
  cursor?: ConversationsCursor;
};

export type ConversationMessagesListQuery = {
  limit: number;
  cursor?: ConversationMessagesCursor;
};

export type CreateTextMessageInput = {
  kind: "text";
  text: string;
};

const uuidParamSchema = z.string().uuid();

const createTextMessageSchema = z
  .object({
    kind: z.literal("text"),
    text: z.string().trim().min(1).max(2000),
  })
  .strict();

export function parseConversationIdParam(value: string): string {
  const parsed = uuidParamSchema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError(404, "NOT_FOUND", "Conversation not found");
  }
  return parsed.data;
}

function parseLimit(
  raw: string | null,
  defaults: { defaultValue: number; max: number },
): number {
  if (raw === null || raw.trim() === "") return defaults.defaultValue;
  if (!/^\d+$/.test(raw.trim())) {
    throw new ApiError(400, "INVALID_INPUT", "Invalid limit");
  }

  const limit = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(limit) || limit < 1) {
    throw new ApiError(400, "INVALID_INPUT", "Invalid limit");
  }

  return Math.min(limit, defaults.max);
}

export function parseConversationsListQuery(
  searchParams: URLSearchParams,
): ConversationsListQuery {
  const limit = parseLimit(searchParams.get("limit"), {
    defaultValue: 20,
    max: 50,
  });
  const cursorRaw = searchParams.get("cursor")?.trim() || undefined;
  const cursor = cursorRaw ? decodeConversationsCursor(cursorRaw) : undefined;

  if (cursor) {
    if (Number.isNaN(Date.parse(cursor.createdAt))) {
      throw new ApiError(400, "INVALID_INPUT", "Invalid cursor");
    }
    if (cursor.lastMessageAt !== null && Number.isNaN(Date.parse(cursor.lastMessageAt))) {
      throw new ApiError(400, "INVALID_INPUT", "Invalid cursor");
    }
  }

  return {
    limit,
    ...(cursor ? { cursor } : {}),
  };
}

export function parseConversationMessagesListQuery(
  searchParams: URLSearchParams,
): ConversationMessagesListQuery {
  const limit = parseLimit(searchParams.get("limit"), {
    defaultValue: 30,
    max: 100,
  });
  const cursorRaw = searchParams.get("cursor")?.trim() || undefined;
  const cursor = cursorRaw ? decodeConversationMessagesCursor(cursorRaw) : undefined;

  if (cursor && Number.isNaN(Date.parse(cursor.val))) {
    throw new ApiError(400, "INVALID_INPUT", "Invalid cursor");
  }

  return {
    limit,
    ...(cursor ? { cursor } : {}),
  };
}

export function parseCreateTextMessageInput(payload: unknown): CreateTextMessageInput {
  const parsed = createTextMessageSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(400, "INVALID_INPUT", "Invalid message payload", parsed.error.flatten());
  }

  return parsed.data;
}

