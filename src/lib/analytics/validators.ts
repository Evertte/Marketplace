import { ApiError } from "../http/errors";

import type { AnalyticsDateRange, AnalyticsListingsQuery, AnalyticsListingsSort } from "./service";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateOnly(value: string, field: "from" | "to"): Date {
  if (!DATE_RE.test(value)) {
    throw new ApiError(400, "INVALID_QUERY_PARAMS", `Invalid ${field}`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, "INVALID_QUERY_PARAMS", `Invalid ${field}`);
  }

  return date;
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultDateRange(): AnalyticsDateRange {
  const to = new Date();
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - 6);
  return { from: start, to: end };
}

export function parseAnalyticsDateRange(params: URLSearchParams): AnalyticsDateRange {
  const fromRaw = params.get("from")?.trim();
  const toRaw = params.get("to")?.trim();

  if (!fromRaw && !toRaw) {
    return defaultDateRange();
  }

  if (!fromRaw || !toRaw) {
    throw new ApiError(400, "INVALID_QUERY_PARAMS", "Both from and to are required");
  }

  const from = parseDateOnly(fromRaw, "from");
  const to = parseDateOnly(toRaw, "to");
  if (from > to) {
    throw new ApiError(400, "INVALID_QUERY_PARAMS", "from cannot be after to");
  }

  return { from, to };
}

export function parseAnalyticsListingsQuery(params: URLSearchParams): AnalyticsListingsQuery {
  const range = parseAnalyticsDateRange(params);
  const sortRaw = params.get("sort")?.trim();
  const limitRaw = params.get("limit")?.trim();

  const sort: AnalyticsListingsSort = sortRaw === "inquiries" || sortRaw === "conversion"
    ? sortRaw
    : "views";

  let limit = 20;
  if (limitRaw) {
    if (!/^\d+$/.test(limitRaw)) {
      throw new ApiError(400, "INVALID_QUERY_PARAMS", "Invalid limit");
    }
    limit = Math.min(Math.max(Number.parseInt(limitRaw, 10), 1), 50);
  }

  return {
    from: range.from,
    to: range.to,
    sort,
    limit,
  };
}

export function formatAnalyticsDateRange(range: AnalyticsDateRange): { from: string; to: string } {
  return {
    from: formatDateOnly(range.from),
    to: formatDateOnly(range.to),
  };
}
