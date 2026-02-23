import type { ListingType } from "@prisma/client";

import { ApiError } from "../http/errors";
import {
  decodeListingsCursor,
  type PublicListingsCursor,
  type PublicListingsCursorOrder,
  type PublicListingsCursorSort,
} from "./cursor";

export type ListingsSortField = "publishedAt" | "price";
export type ListingsSortOrder = "asc" | "desc";

export type ParsedListingsQuery = {
  type?: ListingType;
  q?: string;
  minPrice?: string;
  maxPrice?: string;
  country?: string;
  region?: string;
  city?: string;
  sort?: ListingsSortField;
  order?: ListingsSortOrder;
  limit: number;
  cursor?: PublicListingsCursor;
  effectiveCursorSort: PublicListingsCursorSort;
  effectiveCursorOrder: PublicListingsCursorOrder;
  useRankFirstDefault: boolean;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getTrimmed(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key);
  if (value === null) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function parseListingType(value: string | undefined): ListingType | undefined {
  if (!value) return undefined;
  if (value === "car" || value === "building" || value === "land") return value;
  throw new ApiError(400, "INVALID_QUERY_PARAMS", "Invalid type");
}

function parseDecimalString(
  value: string | undefined,
  field: "min_price" | "max_price",
): string | undefined {
  if (!value) return undefined;
  if (!/^\d+(\.\d+)?$/.test(value)) {
    throw new ApiError(400, "INVALID_QUERY_PARAMS", `Invalid ${field}`);
  }
  return value;
}

function parseSort(value: string | undefined): ListingsSortField | undefined {
  if (!value) return undefined;
  if (value === "publishedAt" || value === "price") return value;
  throw new ApiError(400, "INVALID_QUERY_PARAMS", "Invalid sort");
}

function parseOrder(value: string | undefined): ListingsSortOrder | undefined {
  if (!value) return undefined;
  if (value === "asc" || value === "desc") return value;
  throw new ApiError(400, "INVALID_QUERY_PARAMS", "Invalid order");
}

function parseLimit(value: string | undefined): number {
  if (!value) return 20;
  if (!/^\d+$/.test(value)) {
    throw new ApiError(400, "INVALID_QUERY_PARAMS", "Invalid limit");
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ApiError(400, "INVALID_QUERY_PARAMS", "Invalid limit");
  }

  return Math.min(parsed, 50);
}

export function parsePublicListingsQuery(searchParams: URLSearchParams): ParsedListingsQuery {
  const q = getTrimmed(searchParams, "q");
  const sort = parseSort(getTrimmed(searchParams, "sort"));
  const orderParam = parseOrder(getTrimmed(searchParams, "order"));
  const useRankFirstDefault = Boolean(q) && !sort;

  const effectiveCursorSort: PublicListingsCursorSort = sort ?? "publishedAt";
  const effectiveCursorOrder: PublicListingsCursorOrder = useRankFirstDefault
    ? "desc"
    : (orderParam ?? (effectiveCursorSort === "price" ? "asc" : "desc"));

  const cursorRaw = getTrimmed(searchParams, "cursor");
  const cursor = cursorRaw ? decodeListingsCursor(cursorRaw) : undefined;

  if (cursor) {
    if (cursor.sort !== effectiveCursorSort || cursor.order !== effectiveCursorOrder) {
      throw new ApiError(
        400,
        "INVALID_QUERY_PARAMS",
        "Cursor does not match current sort or order",
      );
    }
    if (!UUID_RE.test(cursor.id)) {
      throw new ApiError(400, "INVALID_QUERY_PARAMS", "Invalid cursor");
    }
    if (cursor.sort === "publishedAt" && Number.isNaN(Date.parse(cursor.val))) {
      throw new ApiError(400, "INVALID_QUERY_PARAMS", "Invalid cursor");
    }
    if (cursor.sort === "price" && !/^\d+(\.\d+)?$/.test(cursor.val)) {
      throw new ApiError(400, "INVALID_QUERY_PARAMS", "Invalid cursor");
    }
  }

  const minPrice = parseDecimalString(getTrimmed(searchParams, "min_price"), "min_price");
  const maxPrice = parseDecimalString(getTrimmed(searchParams, "max_price"), "max_price");

  if (
    minPrice !== undefined &&
    maxPrice !== undefined &&
    Number.parseFloat(minPrice) > Number.parseFloat(maxPrice)
  ) {
    throw new ApiError(400, "INVALID_QUERY_PARAMS", "min_price cannot exceed max_price");
  }

  return {
    type: parseListingType(getTrimmed(searchParams, "type")),
    q,
    minPrice,
    maxPrice,
    country: getTrimmed(searchParams, "country"),
    region: getTrimmed(searchParams, "region"),
    city: getTrimmed(searchParams, "city"),
    sort,
    order: orderParam,
    limit: parseLimit(getTrimmed(searchParams, "limit")),
    cursor,
    effectiveCursorSort,
    effectiveCursorOrder,
    useRankFirstDefault,
  };
}

export function isUuidLike(value: string): boolean {
  return UUID_RE.test(value);
}
