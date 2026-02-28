import { createHash } from "node:crypto";

import { Prisma, type ListingStatus, type NotificationType } from "@prisma/client";
import type { NextRequest } from "next/server";

import { verifySupabaseJwt } from "../auth/supabaseJwt";
import { prisma } from "../db/prisma";
import { ApiError } from "../http/errors";

export type AnalyticsDateRange = {
  from: Date;
  to: Date;
};

export type AnalyticsOverviewResponse = {
  data: {
    totals: {
      viewsTotal: number;
      viewsUnique: number;
      inquiriesTotal: number;
      conversationsStarted: number;
      conversionRate: number;
    };
    series: Array<{
      date: string;
      viewsTotal: number;
      viewsUnique: number;
      inquiriesTotal: number;
      conversationsStarted: number;
      conversionRate: number;
    }>;
  };
};

export type AnalyticsListingsResponse = {
  data: Array<{
    listingId: string;
    title: string;
    type: "car" | "building" | "land";
    region: string;
    status: ListingStatus;
    publishedAt: string | null;
    viewsTotalSum: number;
    viewsUniqueSum: number;
    inquiriesTotalSum: number;
    conversationsStartedSum: number;
    conversionRate: number;
  }>;
};

export type AnalyticsListingsSort = "views" | "inquiries" | "conversion";

export type AnalyticsListingsQuery = {
  from: Date;
  to: Date;
  sort: AnalyticsListingsSort;
  limit: number;
};

export type RecordListingViewResult = {
  tracked: boolean;
};

function toUtcDayBucket(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toConversionRate(inquiries: number, views: number): number {
  if (views <= 0) return 0;
  return Number((inquiries / views).toFixed(4));
}

function hashValue(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function resolveRequestIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;

  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

async function resolveOptionalAuthSubject(req: NextRequest): Promise<string | null> {
  const authorization = req.headers.get("authorization")?.trim();
  if (!authorization) return null;

  const [scheme, token] = authorization.split(/\s+/, 2);
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  try {
    const verified = await verifySupabaseJwt(token);
    return verified.sub;
  } catch {
    return null;
  }
}

export async function resolveListingVisitorHash(req: NextRequest): Promise<string> {
  const authSubject = await resolveOptionalAuthSubject(req);
  if (authSubject) {
    return hashValue(`auth:${authSubject}`);
  }

  const ip = resolveRequestIp(req);
  const userAgent = req.headers.get("user-agent")?.trim() || "unknown";
  return hashValue(`anon:${ip}|${userAgent}`);
}

async function incrementMetrics(
  tx: Prisma.TransactionClient,
  args: {
    listingId: string;
    date: Date;
    viewsTotal?: number;
    viewsUnique?: number;
    inquiriesTotal?: number;
    conversationsStarted?: number;
  },
): Promise<void> {
  await tx.listingDailyMetrics.upsert({
    where: {
      listingId_date: {
        listingId: args.listingId,
        date: args.date,
      },
    },
    create: {
      listingId: args.listingId,
      date: args.date,
      viewsTotal: args.viewsTotal ?? 0,
      viewsUnique: args.viewsUnique ?? 0,
      inquiriesTotal: args.inquiriesTotal ?? 0,
      conversationsStarted: args.conversationsStarted ?? 0,
    },
    update: {
      ...(args.viewsTotal ? { viewsTotal: { increment: args.viewsTotal } } : {}),
      ...(args.viewsUnique ? { viewsUnique: { increment: args.viewsUnique } } : {}),
      ...(args.inquiriesTotal ? { inquiriesTotal: { increment: args.inquiriesTotal } } : {}),
      ...(args.conversationsStarted
        ? { conversationsStarted: { increment: args.conversationsStarted } }
        : {}),
    },
    select: { id: true },
  });
}

export async function recordListingView(args: {
  listingId: string;
  visitorHash: string;
}): Promise<RecordListingViewResult> {
  const date = toUtcDayBucket();

  return prisma.$transaction(async (tx) => {
    const listing = await tx.listing.findFirst({
      where: {
        id: args.listingId,
        status: "published",
      },
      select: { id: true },
    });

    if (!listing) {
      return { tracked: false };
    }

    await incrementMetrics(tx, {
      listingId: listing.id,
      date,
      viewsTotal: 1,
    });

    const uniqueInsert = await tx.listingViewDailyUnique.createMany({
      data: [
        {
          listingId: listing.id,
          date,
          visitorHash: args.visitorHash,
        },
      ],
      skipDuplicates: true,
    });

    if (uniqueInsert.count > 0) {
      await incrementMetrics(tx, {
        listingId: listing.id,
        date,
        viewsUnique: 1,
      });
    }

    return { tracked: true };
  });
}

export async function incrementInquiryMetrics(
  tx: Prisma.TransactionClient,
  args: {
    listingId: string;
    conversationCreated: boolean;
  },
): Promise<void> {
  await incrementMetrics(tx, {
    listingId: args.listingId,
    date: toUtcDayBucket(),
    inquiriesTotal: 1,
    conversationsStarted: args.conversationCreated ? 1 : 0,
  });
}

type OverviewTotalsRow = {
  viewsTotal: number | bigint | null;
  viewsUnique: number | bigint | null;
  inquiriesTotal: number | bigint | null;
  conversationsStarted: number | bigint | null;
};

type ListingsAggregateRow = {
  listingId: string;
  title: string;
  type: "car" | "building" | "land";
  region: string;
  status: ListingStatus;
  publishedAt: Date | null;
  viewsTotalSum: number;
  viewsUniqueSum: number;
  inquiriesTotalSum: number;
  conversationsStartedSum: number;
};

function numericToInt(value: number | bigint | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "bigint" ? Number(value) : value;
}

function enumerateDateRange(range: AnalyticsDateRange): string[] {
  const days: string[] = [];
  const cursor = new Date(range.from);
  while (cursor <= range.to) {
    days.push(toIsoDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export async function getAnalyticsOverview(
  range: AnalyticsDateRange,
): Promise<AnalyticsOverviewResponse> {
  const [totalsRow, grouped] = await Promise.all([
    prisma.$queryRaw<OverviewTotalsRow[]>(Prisma.sql`
      SELECT
        COALESCE(SUM("viewsTotal"), 0)::bigint AS "viewsTotal",
        COALESCE(SUM("viewsUnique"), 0)::bigint AS "viewsUnique",
        COALESCE(SUM("inquiriesTotal"), 0)::bigint AS "inquiriesTotal",
        COALESCE(SUM("conversationsStarted"), 0)::bigint AS "conversationsStarted"
      FROM "ListingDailyMetrics"
      WHERE date >= ${range.from} AND date <= ${range.to}
    `),
    prisma.listingDailyMetrics.groupBy({
      by: ["date"],
      where: {
        date: {
          gte: range.from,
          lte: range.to,
        },
      },
      _sum: {
        viewsTotal: true,
        viewsUnique: true,
        inquiriesTotal: true,
        conversationsStarted: true,
      },
      orderBy: {
        date: "asc",
      },
    }),
  ]);

  const totals = totalsRow[0] ?? {
    viewsTotal: 0,
    viewsUnique: 0,
    inquiriesTotal: 0,
    conversationsStarted: 0,
  };

  const groupedByDay = new Map(
    grouped.map((row) => [
      toIsoDate(row.date),
      {
        viewsTotal: row._sum.viewsTotal ?? 0,
        viewsUnique: row._sum.viewsUnique ?? 0,
        inquiriesTotal: row._sum.inquiriesTotal ?? 0,
        conversationsStarted: row._sum.conversationsStarted ?? 0,
      },
    ]),
  );

  const series = enumerateDateRange(range).map((date) => {
    const day = groupedByDay.get(date) ?? {
      viewsTotal: 0,
      viewsUnique: 0,
      inquiriesTotal: 0,
      conversationsStarted: 0,
    };

    return {
      date,
      viewsTotal: day.viewsTotal,
      viewsUnique: day.viewsUnique,
      inquiriesTotal: day.inquiriesTotal,
      conversationsStarted: day.conversationsStarted,
      conversionRate: toConversionRate(day.inquiriesTotal, day.viewsTotal),
    };
  });

  const totalViews = numericToInt(totals.viewsTotal);
  const totalUniques = numericToInt(totals.viewsUnique);
  const totalInquiries = numericToInt(totals.inquiriesTotal);
  const totalConversationsStarted = numericToInt(totals.conversationsStarted);

  return {
    data: {
      totals: {
        viewsTotal: totalViews,
        viewsUnique: totalUniques,
        inquiriesTotal: totalInquiries,
        conversationsStarted: totalConversationsStarted,
        conversionRate: toConversionRate(totalInquiries, totalViews),
      },
      series,
    },
  };
}

export async function getAnalyticsListings(
  query: AnalyticsListingsQuery,
): Promise<AnalyticsListingsResponse> {
  const orderClause =
    query.sort === "inquiries"
      ? Prisma.sql`COALESCE(SUM(m."inquiriesTotal"), 0) DESC, COALESCE(SUM(m."viewsTotal"), 0) DESC, l.id DESC`
      : query.sort === "conversion"
        ? Prisma.sql`
            CASE
              WHEN COALESCE(SUM(m."viewsTotal"), 0) = 0 THEN 0
              ELSE COALESCE(SUM(m."inquiriesTotal"), 0)::decimal / COALESCE(SUM(m."viewsTotal"), 0)::decimal
            END DESC,
            COALESCE(SUM(m."inquiriesTotal"), 0) DESC,
            l.id DESC
          `
        : Prisma.sql`COALESCE(SUM(m."viewsTotal"), 0) DESC, COALESCE(SUM(m."inquiriesTotal"), 0) DESC, l.id DESC`;

  const rows = await prisma.$queryRaw<ListingsAggregateRow[]>(Prisma.sql`
    SELECT
      l.id AS "listingId",
      l.title,
      l.type,
      l."locationRegion" AS region,
      l.status,
      l."publishedAt" AS "publishedAt",
      COALESCE(SUM(m."viewsTotal"), 0)::int AS "viewsTotalSum",
      COALESCE(SUM(m."viewsUnique"), 0)::int AS "viewsUniqueSum",
      COALESCE(SUM(m."inquiriesTotal"), 0)::int AS "inquiriesTotalSum",
      COALESCE(SUM(m."conversationsStarted"), 0)::int AS "conversationsStartedSum"
    FROM "Listing" l
    LEFT JOIN "ListingDailyMetrics" m
      ON m."listingId" = l.id
      AND m.date >= ${query.from}
      AND m.date <= ${query.to}
    GROUP BY l.id, l.title, l.type, l."locationRegion", l.status, l."publishedAt"
    ORDER BY ${orderClause}
    LIMIT ${query.limit}
  `);

  return {
    data: rows.map((row) => ({
      listingId: row.listingId,
      title: row.title,
      type: row.type,
      region: row.region,
      status: row.status,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      viewsTotalSum: row.viewsTotalSum,
      viewsUniqueSum: row.viewsUniqueSum,
      inquiriesTotalSum: row.inquiriesTotalSum,
      conversationsStartedSum: row.conversationsStartedSum,
      conversionRate: toConversionRate(row.inquiriesTotalSum, row.viewsTotalSum),
    })),
  };
}
