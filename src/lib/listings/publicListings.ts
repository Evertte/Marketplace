import type {
  ListingType,
  MediaKind,
  Prisma,
} from "@prisma/client";
import { Prisma as PrismaNamespace } from "@prisma/client";

import { prisma } from "../db/prisma";
import { ApiError } from "../http/errors";
import {
  encodeListingsCursor,
  type PublicListingsCursor,
} from "./cursor";
import type { ParsedListingsQuery } from "./params";

export type ListingCard = {
  id: string;
  type: ListingType;
  title: string;
  price: string;
  currency: string;
  locationCountry: string;
  locationRegion: string;
  locationCity: string;
  publishedAt: string | null;
  createdAt: string;
  coverImageUrl: string | null;
};

export type PublicListingDetail = {
  id: string;
  type: ListingType;
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
  }>;
};

type ListingsListRow = {
  id: string;
  type: ListingType;
  title: string;
  price: string;
  currency: string;
  locationCountry: string;
  locationRegion: string;
  locationCity: string;
  publishedAt: Date | null;
  createdAt: Date;
  coverImageUrl: string | null;
  cursorPublishedAt: Date;
  cursorPrice: string;
  rank: number | null;
};

type ListingsListPage = {
  data: ListingCard[];
  page: {
    limit: number;
    next_cursor: string | null;
    has_more: boolean;
  };
};

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
  if (value === null) return null;
  return value.toString();
}

function mapCardFromPrismaListing(
  listing: {
    id: string;
    type: ListingType;
    title: string;
    price: PrismaNamespace.Decimal;
    currency: string;
    locationCountry: string;
    locationRegion: string;
    locationCity: string;
    publishedAt: Date | null;
    createdAt: Date;
    listingMedia: Array<{ media: { url: string } }>;
  },
): ListingCard {
  return {
    id: listing.id,
    type: listing.type,
    title: listing.title,
    price: decimalToString(listing.price),
    currency: listing.currency,
    locationCountry: listing.locationCountry,
    locationRegion: listing.locationRegion,
    locationCity: listing.locationCity,
    publishedAt: toIsoOrNull(listing.publishedAt),
    createdAt: toIso(listing.createdAt),
    coverImageUrl: listing.listingMedia[0]?.media.url ?? null,
  };
}

function mapCardFromRow(row: ListingsListRow): ListingCard {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    price: row.price,
    currency: row.currency,
    locationCountry: row.locationCountry,
    locationRegion: row.locationRegion,
    locationCity: row.locationCity,
    publishedAt: toIsoOrNull(row.publishedAt),
    createdAt: toIso(row.createdAt),
    coverImageUrl: row.coverImageUrl,
  };
}

function buildNextCursorFromRow(
  row: ListingsListRow,
  params: ParsedListingsQuery,
): string {
  const payload: PublicListingsCursor = {
    v: 1,
    sort: params.effectiveCursorSort,
    order: params.effectiveCursorOrder,
    val:
      params.effectiveCursorSort === "price"
        ? row.cursorPrice
        : toIso(row.cursorPublishedAt),
    id: row.id,
  };

  return encodeListingsCursor(payload);
}

export async function getHomeSections(): Promise<{
  cars: { items: ListingCard[]; next_cursor: null };
  buildings: { items: ListingCard[]; next_cursor: null };
  lands: { items: ListingCard[]; next_cursor: null };
}> {
  const baseSelect = {
    id: true,
    type: true,
    title: true,
    price: true,
    currency: true,
    locationCountry: true,
    locationRegion: true,
    locationCity: true,
    publishedAt: true,
    createdAt: true,
    listingMedia: {
      take: 1,
      orderBy: [{ sortOrder: "asc" as const }, { mediaId: "asc" as const }],
      select: {
        media: { select: { url: true } },
      },
    },
  };

  const queryForType = (type: ListingType) =>
    prisma.listing.findMany({
      where: { status: "published", type },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: 10,
      select: baseSelect,
    });

  const [cars, buildings, lands] = await Promise.all([
    queryForType("car"),
    queryForType("building"),
    queryForType("land"),
  ]);

  return {
    cars: { items: cars.map(mapCardFromPrismaListing), next_cursor: null },
    buildings: { items: buildings.map(mapCardFromPrismaListing), next_cursor: null },
    lands: { items: lands.map(mapCardFromPrismaListing), next_cursor: null },
  };
}

function getCursorComparisonSql(params: ParsedListingsQuery): PrismaNamespace.Sql {
  if (!params.cursor) return PrismaNamespace.empty;

  const cursor = params.cursor;
  const sortExpr =
    params.effectiveCursorSort === "price"
      ? PrismaNamespace.sql`l."price"`
      : PrismaNamespace.sql`COALESCE(l."publishedAt", l."createdAt")`;

  const cursorVal =
    params.effectiveCursorSort === "price" ? cursor.val : new Date(cursor.val);
  const comparator = params.effectiveCursorOrder === "desc"
    ? PrismaNamespace.sql`<`
    : PrismaNamespace.sql`>`;

  return PrismaNamespace.sql`
    AND (
      (${sortExpr} ${comparator} ${cursorVal})
      OR (${sortExpr} = ${cursorVal} AND l."id" ${comparator} ${cursor.id}::uuid)
    )
  `;
}

function getListingsOrderBySql(params: ParsedListingsQuery): PrismaNamespace.Sql {
  const direction =
    params.effectiveCursorOrder === "desc"
      ? PrismaNamespace.sql`DESC`
      : PrismaNamespace.sql`ASC`;

  if (params.useRankFirstDefault) {
    // V1 simplification: q default ordering prioritizes rank, but cursor stability still
    // uses publishedAt/id so clients can paginate with a single cursor shape.
    return PrismaNamespace.sql`
      ORDER BY "rank" DESC NULLS LAST, "cursorPublishedAt" DESC, l."id" DESC
    `;
  }

  if (params.effectiveCursorSort === "price") {
    return PrismaNamespace.sql`
      ORDER BY "cursorPrice" ${direction}, l."id" ${direction}
    `;
  }

  return PrismaNamespace.sql`
    ORDER BY "cursorPublishedAt" ${direction}, l."id" ${direction}
  `;
}

export async function listPublicListings(params: ParsedListingsQuery): Promise<ListingsListPage> {
  const whereClauses: PrismaNamespace.Sql[] = [
    PrismaNamespace.sql`l."status" = 'published'::"ListingStatus"`,
  ];

  if (params.type) {
    whereClauses.push(PrismaNamespace.sql`l."type" = ${params.type}::"ListingType"`);
  }
  if (params.minPrice) {
    whereClauses.push(PrismaNamespace.sql`l."price" >= ${params.minPrice}::numeric`);
  }
  if (params.maxPrice) {
    whereClauses.push(PrismaNamespace.sql`l."price" <= ${params.maxPrice}::numeric`);
  }
  if (params.country) {
    whereClauses.push(
      PrismaNamespace.sql`l."locationCountry" ILIKE ${params.country}`,
    );
  }
  if (params.region) {
    whereClauses.push(
      PrismaNamespace.sql`l."locationRegion" ILIKE ${params.region}`,
    );
  }
  if (params.city) {
    whereClauses.push(PrismaNamespace.sql`l."locationCity" ILIKE ${params.city}`);
  }

  const qTsVector = PrismaNamespace.sql`to_tsvector('simple', COALESCE(l."title", '') || ' ' || COALESCE(l."description", ''))`;
  const qTsQuery = params.q
    ? PrismaNamespace.sql`plainto_tsquery('simple', ${params.q})`
    : null;

  if (qTsQuery) {
    whereClauses.push(PrismaNamespace.sql`${qTsVector} @@ ${qTsQuery}`);
  }

  const cursorPredicate = getCursorComparisonSql(params);
  const orderBySql = getListingsOrderBySql(params);
  const rankSelect = qTsQuery
    ? PrismaNamespace.sql`ts_rank(${qTsVector}, ${qTsQuery}) AS "rank"`
    : PrismaNamespace.sql`NULL::real AS "rank"`;

  const rows = await prisma.$queryRaw<ListingsListRow[]>`
    SELECT
      l."id",
      l."type",
      l."title",
      l."price"::text AS "price",
      l."currency",
      l."locationCountry",
      l."locationRegion",
      l."locationCity",
      l."publishedAt",
      l."createdAt",
      COALESCE(l."publishedAt", l."createdAt") AS "cursorPublishedAt",
      l."price"::text AS "cursorPrice",
      cover."coverImageUrl",
      ${rankSelect}
    FROM "Listing" l
    LEFT JOIN LATERAL (
      SELECT m."url" AS "coverImageUrl"
      FROM "ListingMedia" lm
      INNER JOIN "Media" m ON m."id" = lm."mediaId"
      WHERE lm."listingId" = l."id"
      ORDER BY lm."sortOrder" ASC, lm."mediaId" ASC
      LIMIT 1
    ) cover ON TRUE
    WHERE ${PrismaNamespace.join(whereClauses, " AND ")}
    ${cursorPredicate}
    ${orderBySql}
    LIMIT ${params.limit + 1}
  `;

  const hasMore = rows.length > params.limit;
  const slice = hasMore ? rows.slice(0, params.limit) : rows;
  const nextCursor = hasMore ? buildNextCursorFromRow(slice[slice.length - 1]!, params) : null;

  return {
    data: slice.map(mapCardFromRow),
    page: {
      limit: params.limit,
      next_cursor: nextCursor,
      has_more: hasMore,
    },
  };
}

export async function getPublicListingDetailById(id: string): Promise<PublicListingDetail> {
  const listing = await prisma.listing.findFirst({
    where: {
      id,
      status: "published",
    },
    select: {
      id: true,
      type: true,
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
    })),
  };
}
