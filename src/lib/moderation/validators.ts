import { z } from "zod";

import { ApiError } from "../http/errors";

const uuidSchema = z.string().uuid();
const cuidSchema = z.string().cuid();

const createReportSchema = z
  .object({
    conversationId: z.string().uuid(),
    messageId: z.string().uuid().optional(),
    reason: z.enum(["spam", "scam", "harassment", "inappropriate", "other"]),
    note: z.string().trim().max(1000).optional(),
  })
  .strict();

const updateReportSchema = z
  .object({
    status: z.enum(["reviewing", "resolved", "dismissed"]),
    adminNote: z.string().trim().max(1000).optional(),
  })
  .strict();

const banUserSchema = z
  .object({
    reason: z.string().trim().max(1000).optional(),
  })
  .strict();

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type UpdateReportInput = z.infer<typeof updateReportSchema>;
export type BanUserInput = z.infer<typeof banUserSchema>;
export type AdminReportsQuery = {
  status?: "open" | "reviewing" | "resolved" | "dismissed";
};

export function parseCreateReportInput(payload: unknown): CreateReportInput {
  const parsed = createReportSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(400, "INVALID_INPUT", "Invalid report payload", parsed.error.flatten());
  }

  return {
    ...parsed.data,
    ...(parsed.data.note ? { note: parsed.data.note.trim() } : {}),
  };
}

export function parseAdminReportsQuery(searchParams: URLSearchParams): AdminReportsQuery {
  const status = searchParams.get("status")?.trim();
  if (!status) return {};

  const parsed = z.enum(["open", "reviewing", "resolved", "dismissed"]).safeParse(status);
  if (!parsed.success) {
    throw new ApiError(400, "INVALID_INPUT", "Invalid report status filter");
  }

  return { status: parsed.data };
}

export function parseReportIdParam(value: string): string {
  const parsed = cuidSchema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError(404, "NOT_FOUND", "Report not found");
  }
  return parsed.data;
}

export function parseUserIdParam(value: string): string {
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError(404, "NOT_FOUND", "User not found");
  }
  return parsed.data;
}

export function parseUpdateReportInput(payload: unknown): UpdateReportInput {
  const parsed = updateReportSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(400, "INVALID_INPUT", "Invalid report update payload", parsed.error.flatten());
  }

  return {
    ...parsed.data,
    ...(parsed.data.adminNote ? { adminNote: parsed.data.adminNote.trim() } : {}),
  };
}

export function parseBanUserInput(payload: unknown): BanUserInput {
  const parsed = banUserSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(400, "INVALID_INPUT", "Invalid ban payload", parsed.error.flatten());
  }

  return {
    ...parsed.data,
    ...(parsed.data.reason ? { reason: parsed.data.reason.trim() } : {}),
  };
}
