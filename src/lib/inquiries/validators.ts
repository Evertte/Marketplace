import type { PreferredContact } from "@prisma/client";
import { z } from "zod";

import { ApiError } from "../http/errors";
import { decodeAdminInquiriesCursor, type AdminInquiriesCursor } from "./cursor";

export type CreateInquiryInput = {
  listingId: string;
  message: string;
  preferredContact: PreferredContact;
  phone?: string | null;
};

export type AdminInquiriesQuery = {
  limit: number;
  cursor?: AdminInquiriesCursor;
  listingId?: string;
};

const createInquirySchema = z
  .object({
    listing_id: z.string().uuid(),
    message: z.string().trim().min(1),
    preferred_contact: z.enum(["chat", "whatsapp", "call"]),
    phone: z
      .union([z.string(), z.null()])
      .optional()
      .transform((value) => {
        if (value === undefined || value === null) return undefined;
        const trimmed = value.trim();
        return trimmed === "" ? undefined : trimmed;
      }),
  })
  .strict();

export function parseCreateInquiryInput(payload: unknown): CreateInquiryInput {
  const parsed = createInquirySchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(400, "INVALID_INPUT", "Invalid inquiry payload", parsed.error.flatten());
  }

  return {
    listingId: parsed.data.listing_id,
    message: parsed.data.message,
    preferredContact: parsed.data.preferred_contact,
    ...(parsed.data.phone ? { phone: parsed.data.phone } : {}),
  };
}

const adminInquiriesQuerySchema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).optional(),
  listing_id: z.string().uuid().optional(),
});

export function parseAdminInquiriesQuery(searchParams: URLSearchParams): AdminInquiriesQuery {
  const limitRaw = searchParams.get("limit");
  const cursorRaw = searchParams.get("cursor")?.trim() || undefined;
  const listingIdRaw = searchParams.get("listing_id")?.trim() || undefined;

  const parsed = adminInquiriesQuerySchema.safeParse({
    limit:
      limitRaw === null || limitRaw.trim() === ""
        ? undefined
        : Number.parseInt(limitRaw.trim(), 10),
    cursor: cursorRaw,
    listing_id: listingIdRaw,
  });

  if (!parsed.success) {
    throw new ApiError(400, "INVALID_INPUT", "Invalid query params", parsed.error.flatten());
  }

  if (limitRaw && !/^\d+$/.test(limitRaw.trim())) {
    throw new ApiError(400, "INVALID_INPUT", "Invalid limit");
  }

  const cursor = parsed.data.cursor
    ? decodeAdminInquiriesCursor(parsed.data.cursor)
    : undefined;

  if (cursor && Number.isNaN(Date.parse(cursor.val))) {
    throw new ApiError(400, "INVALID_INPUT", "Invalid cursor");
  }

  return {
    limit: parsed.data.limit,
    ...(cursor ? { cursor } : {}),
    ...(parsed.data.listing_id ? { listingId: parsed.data.listing_id } : {}),
  };
}

