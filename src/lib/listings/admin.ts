import type {
  ListingType as PrismaListingType,
  ListingStatus,
  ListingType,
  MediaKind,
  Prisma,
  User,
} from "@prisma/client";
import { Prisma as PrismaNamespace } from "@prisma/client";
import type { NextRequest } from "next/server";

import { prisma } from "../db/prisma";
import { ApiError } from "../http/errors";
import {
  decodeListingsCursor,
  encodeListingsCursor,
  type PublicListingsCursor,
} from "./cursor";

type AdminActor = Pick<User, "id" | "role" | "status">;

type CreateListingInput = {
  title: string;
  description: string;
  price: string;
  currency: string;
  locationCountry: string;
  locationRegion: string;
  locationCity: string;
  lat?: string | null;
  lng?: string | null;
  typeFields?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
};

type UpdateListingInput = Partial<CreateListingInput>;

type ListingWriteSummary = {
  id: string;
  status: ListingStatus;
  title: string;
  updatedAt: string;
  publishedAt: string | null;
};

export type AdminListingListItem = {
  id: string;
  type: ListingType;
  title: string;
  price: string;
  currency: string;
  locationCountry: string;
  locationRegion: string;
  locationCity: string;
  status: ListingStatus;
  publishedAt: string | null;
  createdAt: string;
  coverImageUrl: string | null;
};

export type AdminListingListPage = {
  data: AdminListingListItem[];
  page: {
    limit: number;
    next_cursor: string | null;
    has_more: boolean;
  };
};

export type AdminListingDetail = {
  id: string;
  type: ListingType;
  status: ListingStatus;
  title: string;
  description: string;
  price: string;
  currency: string;
  locationCountry: string;
  locationRegion: string;
  locationCity: string;
  lat: string | null;
  lng: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  typeFields: Prisma.JsonValue | null;
  media: Array<{
    mediaId: string;
    url: string;
    thumbUrl: string | null;
    kind: MediaKind;
    sortOrder: number;
    status: "uploading" | "ready" | "failed";
  }>;
};

const CREATE_ALLOWED_FIELDS = new Set([
  "title",
  "description",
  "price",
  "currency",
  "locationCountry",
  "locationRegion",
  "locationCity",
  "lat",
  "lng",
  "typeFields",
]);

const PATCH_ALLOWED_FIELDS = CREATE_ALLOWED_FIELDS;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuidLike(value: string): boolean {
  return UUID_RE.test(value);
}

function toIso(value: Date): string {
  return value.toISOString();
}

function toIsoOrNull(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function decimalToString(value: PrismaNamespace.Decimal | string): string {
  return typeof value === "string" ? value : value.toString();
}

function nullableDecimalToString(value: PrismaNamespace.Decimal | null): string | null {
  return value ? value.toString() : null;
}

function assertAllowedKeys(
  payload: Record<string, unknown>,
  allowed: Set<string>,
  context: string,
): void {
  for (const key of Object.keys(payload)) {
    if (!allowed.has(key)) {
      throw new ApiError(400, "INVALID_REQUEST_BODY", `Unexpected field "${key}" in ${context}`);
    }
  }
}

function requireNonEmptyString(
  payload: Record<string, unknown>,
  key: string,
): string {
  const value = payload[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiError(400, "INVALID_REQUEST_BODY", `Invalid ${key}`);
  }
  return value.trim();
}

function optionalNonEmptyString(
  payload: Record<string, unknown>,
  key: string,
): string | undefined {
  if (!(key in payload)) return undefined;
  const value = payload[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiError(400, "INVALID_REQUEST_BODY", `Invalid ${key}`);
  }
  return value.trim();
}

function parseDecimalString(value: unknown, field: string): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new ApiError(400, "INVALID_REQUEST_BODY", `Invalid ${field}`);
    }
    return String(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
      throw new ApiError(400, "INVALID_REQUEST_BODY", `Invalid ${field}`);
    }
    return trimmed;
  }

  throw new ApiError(400, "INVALID_REQUEST_BODY", `Invalid ${field}`);
}

function parseOptionalDecimal(
  payload: Record<string, unknown>,
  key: "lat" | "lng",
): string | null | undefined {
  if (!(key in payload)) return undefined;
  const value = payload[key];
  if (value === null) return null;
  return parseDecimalString(value, key);
}

function parseJsonField(
  payload: Record<string, unknown>,
  key: "typeFields",
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (!(key in payload)) return undefined;
  const value = payload[key];
  if (value === null) {
    return PrismaNamespace.DbNull;
  }
  return value as Prisma.InputJsonValue;
}

export async function readJsonObjectBody(
  req: NextRequest,
  options?: { code?: string },
): Promise<Record<string, unknown>> {
  const code = options?.code ?? "INVALID_REQUEST_BODY";
  let parsed: unknown;

  try {
    parsed = await req.json();
  } catch {
    throw new ApiError(400, code, "Request body must be valid JSON");
  }

  if (!isPlainObject(parsed)) {
    throw new ApiError(400, code, "Request body must be a JSON object");
  }

  return parsed;
}

function parseCreateInput(payload: Record<string, unknown>): CreateListingInput {
  assertAllowedKeys(payload, CREATE_ALLOWED_FIELDS, "create listing payload");

  return {
    title: requireNonEmptyString(payload, "title"),
    description: requireNonEmptyString(payload, "description"),
    price: parseDecimalString(payload.price, "price"),
    currency: requireNonEmptyString(payload, "currency"),
    locationCountry: requireNonEmptyString(payload, "locationCountry"),
    locationRegion: requireNonEmptyString(payload, "locationRegion"),
    locationCity: requireNonEmptyString(payload, "locationCity"),
    ...(parseOptionalDecimal(payload, "lat") !== undefined
      ? { lat: parseOptionalDecimal(payload, "lat") }
      : {}),
    ...(parseOptionalDecimal(payload, "lng") !== undefined
      ? { lng: parseOptionalDecimal(payload, "lng") }
      : {}),
    ...(parseJsonField(payload, "typeFields") !== undefined
      ? { typeFields: parseJsonField(payload, "typeFields")! }
      : {}),
  };
}

function parsePatchInput(payload: Record<string, unknown>): UpdateListingInput {
  assertAllowedKeys(payload, PATCH_ALLOWED_FIELDS, "update listing payload");

  const update: UpdateListingInput = {};

  const title = optionalNonEmptyString(payload, "title");
  if (title !== undefined) update.title = title;

  const description = optionalNonEmptyString(payload, "description");
  if (description !== undefined) update.description = description;

  const currency = optionalNonEmptyString(payload, "currency");
  if (currency !== undefined) update.currency = currency;

  const locationCountry = optionalNonEmptyString(payload, "locationCountry");
  if (locationCountry !== undefined) update.locationCountry = locationCountry;

  const locationRegion = optionalNonEmptyString(payload, "locationRegion");
  if (locationRegion !== undefined) update.locationRegion = locationRegion;

  const locationCity = optionalNonEmptyString(payload, "locationCity");
  if (locationCity !== undefined) update.locationCity = locationCity;

  if ("price" in payload) {
    update.price = parseDecimalString(payload.price, "price");
  }

  const lat = parseOptionalDecimal(payload, "lat");
  if (lat !== undefined) update.lat = lat;

  const lng = parseOptionalDecimal(payload, "lng");
  if (lng !== undefined) update.lng = lng;

  const typeFields = parseJsonField(payload, "typeFields");
  if (typeFields !== undefined) {
    update.typeFields = typeFields;
  }

  if (Object.keys(update).length === 0) {
    throw new ApiError(400, "INVALID_REQUEST_BODY", "No updatable fields provided");
  }

  return update;
}

function mapListingWriteSummary(listing: {
  id: string;
  status: ListingStatus;
  title: string;
  updatedAt: Date;
  publishedAt: Date | null;
}): ListingWriteSummary {
  return {
    id: listing.id,
    status: listing.status,
    title: listing.title,
    updatedAt: listing.updatedAt.toISOString(),
    publishedAt: listing.publishedAt?.toISOString() ?? null,
  };
}

function assertValidListingId(id: string): void {
  if (!isUuidLike(id)) {
    throw new ApiError(404, "NOT_FOUND", "Listing not found");
  }
}

export async function createAdminListing(
  actor: AdminActor,
  type: ListingType,
  payload: Record<string, unknown>,
): Promise<{ id: string; status: ListingStatus }> {
  const input = parseCreateInput(payload);

  const listing = await prisma.listing.create({
    data: {
      type,
      title: input.title,
      description: input.description,
      price: input.price,
      currency: input.currency,
      locationCountry: input.locationCountry,
      locationRegion: input.locationRegion,
      locationCity: input.locationCity,
      ...(input.lat === undefined ? {} : { lat: input.lat }),
      ...(input.lng === undefined ? {} : { lng: input.lng }),
      ...(input.typeFields === undefined ? {} : { typeFields: input.typeFields }),
      status: "draft",
      publishedAt: null,
      createdById: actor.id,
    },
    select: {
      id: true,
      status: true,
    },
  });

  return listing;
}

export async function updateAdminListing(
  actor: AdminActor,
  listingId: string,
  payload: Record<string, unknown>,
): Promise<ListingWriteSummary> {
  void actor;
  assertValidListingId(listingId);
  const input = parsePatchInput(payload);

  const existing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      status: true,
    },
  });

  if (!existing) {
    throw new ApiError(404, "NOT_FOUND", "Listing not found");
  }

  if (existing.status === "archived") {
    throw new ApiError(
      400,
      "INVALID_STATE_TRANSITION",
      "Archived listings cannot be updated",
    );
  }

  const updated = await prisma.listing.update({
    where: { id: listingId },
    data: {
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.description === undefined ? {} : { description: input.description }),
      ...(input.price === undefined ? {} : { price: input.price }),
      ...(input.currency === undefined ? {} : { currency: input.currency }),
      ...(input.locationCountry === undefined
        ? {}
        : { locationCountry: input.locationCountry }),
      ...(input.locationRegion === undefined ? {} : { locationRegion: input.locationRegion }),
      ...(input.locationCity === undefined ? {} : { locationCity: input.locationCity }),
      ...(input.lat === undefined ? {} : { lat: input.lat }),
      ...(input.lng === undefined ? {} : { lng: input.lng }),
      ...(input.typeFields === undefined ? {} : { typeFields: input.typeFields }),
    },
    select: {
      id: true,
      status: true,
      title: true,
      updatedAt: true,
      publishedAt: true,
    },
  });

  return mapListingWriteSummary(updated);
}

async function transitionListingStatus(
  actor: AdminActor,
  listingId: string,
  options: {
    action: "LISTING_PUBLISHED" | "LISTING_UNPUBLISHED" | "LISTING_ARCHIVED";
    allowedFrom: ListingStatus[];
    toStatus: ListingStatus;
    publishedAtMode: "set_now" | "clear" | "keep";
  },
): Promise<ListingWriteSummary> {
  assertValidListingId(listingId);

  return prisma.$transaction(async (tx) => {
    const listing = await tx.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!listing) {
      throw new ApiError(404, "NOT_FOUND", "Listing not found");
    }

    if (!options.allowedFrom.includes(listing.status)) {
      throw new ApiError(
        400,
        "INVALID_STATE_TRANSITION",
        `Cannot transition listing from ${listing.status} to ${options.toStatus}`,
      );
    }

    const updated = await tx.listing.update({
      where: { id: listing.id },
      data: {
        status: options.toStatus,
        ...(options.publishedAtMode === "set_now"
          ? { publishedAt: new Date() }
          : options.publishedAtMode === "clear"
            ? { publishedAt: null }
            : {}),
      },
      select: {
        id: true,
        status: true,
        title: true,
        updatedAt: true,
        publishedAt: true,
      },
    });

    await tx.adminAuditLog.create({
      data: {
        actorUserId: actor.id,
        action: options.action,
        entityType: "listing",
        entityId: listing.id,
        metadata: {
          previousStatus: listing.status,
          newStatus: updated.status,
        },
      },
    });

    return mapListingWriteSummary(updated);
  });
}

export async function publishAdminListing(
  actor: AdminActor,
  listingId: string,
): Promise<ListingWriteSummary> {
  return transitionListingStatus(actor, listingId, {
    action: "LISTING_PUBLISHED",
    allowedFrom: ["draft"],
    toStatus: "published",
    publishedAtMode: "set_now",
  });
}

export async function unpublishAdminListing(
  actor: AdminActor,
  listingId: string,
): Promise<ListingWriteSummary> {
  return transitionListingStatus(actor, listingId, {
    action: "LISTING_UNPUBLISHED",
    allowedFrom: ["published"],
    toStatus: "draft",
    publishedAtMode: "clear",
  });
}

export async function archiveAdminListing(
  actor: AdminActor,
  listingId: string,
): Promise<ListingWriteSummary> {
  return transitionListingStatus(actor, listingId, {
    action: "LISTING_ARCHIVED",
    allowedFrom: ["draft", "published"],
    toStatus: "archived",
    publishedAtMode: "keep",
  });
}

function parseSortOrder(value: unknown): number {
  const num =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isInteger(num) || num < 0) {
    throw new ApiError(400, "INVALID_INPUT", "Invalid sort_order");
  }

  return num;
}

function parseAttachListingMediaInput(payload: Record<string, unknown>): {
  mediaId: string;
  sortOrder: number;
} {
  const mediaId = requireNonEmptyString(payload, "media_id");
  if (!isUuidLike(mediaId)) {
    throw new ApiError(400, "INVALID_INPUT", "Invalid media_id");
  }

  if (!("sort_order" in payload)) {
    throw new ApiError(400, "INVALID_INPUT", "Missing sort_order");
  }

  return {
    mediaId,
    sortOrder: parseSortOrder(payload.sort_order),
  };
}

export async function attachMediaToListing(
  actor: AdminActor,
  listingId: string,
  payload: Record<string, unknown>,
): Promise<{ listing_id: string; media_id: string }> {
  void actor;
  assertValidListingId(listingId);
  const { mediaId, sortOrder } = parseAttachListingMediaInput(payload);

  const [listing, media] = await Promise.all([
    prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true },
    }),
    prisma.media.findUnique({
      where: { id: mediaId },
      select: { id: true, purpose: true, status: true },
    }),
  ]);

  if (!listing) {
    throw new ApiError(404, "NOT_FOUND", "Listing not found");
  }

  if (!media) {
    throw new ApiError(404, "NOT_FOUND", "Media not found");
  }

  if (media.purpose !== "listing") {
    throw new ApiError(400, "INVALID_INPUT", "Media purpose must be listing");
  }

  if (media.status !== "ready") {
    throw new ApiError(400, "INVALID_INPUT", "Media must be ready before attaching");
  }

  try {
    await prisma.listingMedia.create({
      data: {
        listingId,
        mediaId,
        sortOrder,
      },
    });
  } catch (error) {
    if (
      error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ApiError(400, "INVALID_INPUT", "Media is already attached to listing");
    }
    throw error;
  }

  return {
    listing_id: listingId,
    media_id: mediaId,
  };
}

export async function detachMediaFromListing(
  actor: AdminActor,
  listingId: string,
  mediaId: string,
): Promise<void> {
  void actor;
  assertValidListingId(listingId);
  if (!isUuidLike(mediaId)) {
    throw new ApiError(404, "NOT_FOUND", "Listing media link not found");
  }

  const result = await prisma.listingMedia.deleteMany({
    where: {
      listingId,
      mediaId,
    },
  });

  if (result.count === 0) {
    throw new ApiError(404, "NOT_FOUND", "Listing media link not found");
  }
}

type AdminListingsQuery = {
  type?: PrismaListingType;
  status?: ListingStatus;
  limit: number;
  cursor?: PublicListingsCursor;
};

type AdminListingsRow = {
  id: string;
  type: ListingType;
  title: string;
  price: string;
  currency: string;
  locationCountry: string;
  locationRegion: string;
  locationCity: string;
  status: ListingStatus;
  publishedAt: Date | null;
  createdAt: Date;
  coverImageUrl: string | null;
  cursorPublishedAt: Date;
};

export function parseAdminListingsQuery(searchParams: URLSearchParams): AdminListingsQuery {
  const typeRaw = searchParams.get("type")?.trim() || undefined;
  const statusRaw = searchParams.get("status")?.trim() || undefined;
  const limitRaw = searchParams.get("limit")?.trim() || undefined;
  const cursorRaw = searchParams.get("cursor")?.trim() || undefined;

  let type: ListingType | undefined;
  if (typeRaw) {
    if (typeRaw === "car" || typeRaw === "building" || typeRaw === "land") {
      type = typeRaw;
    } else if (typeRaw !== "all") {
      throw new ApiError(400, "INVALID_QUERY_PARAMS", "Invalid type");
    }
  }

  let status: ListingStatus | undefined;
  if (statusRaw) {
    if (statusRaw === "draft" || statusRaw === "published" || statusRaw === "archived") {
      status = statusRaw;
    } else if (statusRaw !== "all") {
      throw new ApiError(400, "INVALID_QUERY_PARAMS", "Invalid status");
    }
  }

  let limit = 20;
  if (limitRaw) {
    if (!/^\d+$/.test(limitRaw)) {
      throw new ApiError(400, "INVALID_QUERY_PARAMS", "Invalid limit");
    }
    limit = Math.min(Math.max(Number.parseInt(limitRaw, 10), 1), 50);
  }

  let cursor: PublicListingsCursor | undefined;
  if (cursorRaw) {
    cursor = decodeListingsCursor(cursorRaw);
    if (cursor.sort !== "publishedAt" || cursor.order !== "desc") {
      throw new ApiError(400, "INVALID_QUERY_PARAMS", "Invalid cursor");
    }
    if (!isUuidLike(cursor.id) || Number.isNaN(Date.parse(cursor.val))) {
      throw new ApiError(400, "INVALID_QUERY_PARAMS", "Invalid cursor");
    }
  }

  return { type, status, limit, cursor };
}

export async function listAdminListings(
  _actor: AdminActor,
  query: AdminListingsQuery,
): Promise<AdminListingListPage> {
  const whereClauses: PrismaNamespace.Sql[] = [];
  if (query.type) {
    whereClauses.push(PrismaNamespace.sql`l."type" = ${query.type}::"ListingType"`);
  }
  if (query.status) {
    whereClauses.push(PrismaNamespace.sql`l."status" = ${query.status}::"ListingStatus"`);
  }

  if (query.cursor) {
    const cursorDate = new Date(query.cursor.val);
    whereClauses.push(PrismaNamespace.sql`
      (
        COALESCE(l."publishedAt", l."createdAt") < ${cursorDate}
        OR (
          COALESCE(l."publishedAt", l."createdAt") = ${cursorDate}
          AND l."id" < ${query.cursor.id}::uuid
        )
      )
    `);
  }

  const whereSql = whereClauses.length
    ? PrismaNamespace.sql`WHERE ${PrismaNamespace.join(whereClauses, " AND ")}`
    : PrismaNamespace.empty;

  const rows = await prisma.$queryRaw<AdminListingsRow[]>`
    SELECT
      l."id",
      l."type",
      l."title",
      l."price"::text AS "price",
      l."currency",
      l."locationCountry",
      l."locationRegion",
      l."locationCity",
      l."status",
      l."publishedAt",
      l."createdAt",
      COALESCE(l."publishedAt", l."createdAt") AS "cursorPublishedAt",
      cover."coverImageUrl"
    FROM "Listing" l
    LEFT JOIN LATERAL (
      SELECT m."url" AS "coverImageUrl"
      FROM "ListingMedia" lm
      INNER JOIN "Media" m ON m."id" = lm."mediaId"
      WHERE lm."listingId" = l."id"
      ORDER BY lm."sortOrder" ASC, lm."mediaId" ASC
      LIMIT 1
    ) cover ON TRUE
    ${whereSql}
    ORDER BY COALESCE(l."publishedAt", l."createdAt") DESC, l."id" DESC
    LIMIT ${query.limit + 1}
  `;

  const hasMore = rows.length > query.limit;
  const slice = hasMore ? rows.slice(0, query.limit) : rows;
  const nextCursor = hasMore
    ? encodeListingsCursor({
        v: 1,
        sort: "publishedAt",
        order: "desc",
        val: slice[slice.length - 1]!.cursorPublishedAt.toISOString(),
        id: slice[slice.length - 1]!.id,
      })
    : null;

  return {
    data: slice.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      price: row.price,
      currency: row.currency,
      locationCountry: row.locationCountry,
      locationRegion: row.locationRegion,
      locationCity: row.locationCity,
      status: row.status,
      publishedAt: toIsoOrNull(row.publishedAt),
      createdAt: toIso(row.createdAt),
      coverImageUrl: row.coverImageUrl,
    })),
    page: {
      limit: query.limit,
      next_cursor: nextCursor,
      has_more: hasMore,
    },
  };
}

export async function getAdminListingDetail(
  _actor: AdminActor,
  listingId: string,
): Promise<AdminListingDetail> {
  assertValidListingId(listingId);

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      type: true,
      status: true,
      title: true,
      description: true,
      price: true,
      currency: true,
      locationCountry: true,
      locationRegion: true,
      locationCity: true,
      lat: true,
      lng: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      typeFields: true,
      listingMedia: {
        orderBy: [{ sortOrder: "asc" }, { mediaId: "asc" }],
        select: {
          sortOrder: true,
          mediaId: true,
          media: {
            select: {
              url: true,
              thumbUrl: true,
              kind: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!listing) {
    throw new ApiError(404, "NOT_FOUND", "Listing not found");
  }

  return {
    id: listing.id,
    type: listing.type,
    status: listing.status,
    title: listing.title,
    description: listing.description,
    price: decimalToString(listing.price),
    currency: listing.currency,
    locationCountry: listing.locationCountry,
    locationRegion: listing.locationRegion,
    locationCity: listing.locationCity,
    lat: nullableDecimalToString(listing.lat),
    lng: nullableDecimalToString(listing.lng),
    publishedAt: toIsoOrNull(listing.publishedAt),
    createdAt: toIso(listing.createdAt),
    updatedAt: toIso(listing.updatedAt),
    typeFields: (listing.typeFields ?? null) as Prisma.JsonValue | null,
    media: listing.listingMedia.map((item) => ({
      mediaId: item.mediaId,
      url: item.media.url,
      thumbUrl: item.media.thumbUrl ?? null,
      kind: item.media.kind,
      sortOrder: item.sortOrder,
      status: item.media.status,
    })),
  };
}
