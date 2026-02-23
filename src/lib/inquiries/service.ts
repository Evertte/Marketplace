import type { Inquiry, PreferredContact, User } from "@prisma/client";
import { Prisma as PrismaNamespace } from "@prisma/client";

import { prisma } from "../db/prisma";
import { ApiError } from "../http/errors";
import {
  encodeAdminInquiriesCursor,
  type AdminInquiriesCursor,
} from "./cursor";
import type { AdminInquiriesQuery, CreateInquiryInput } from "./validators";

type AuthenticatedBuyer = Pick<User, "id">;
type AdminActor = Pick<User, "id" | "role" | "status">;

type CreateInquiryResult = {
  inquiry_id: string;
  conversation_id: string;
  listing_id: string;
  created: boolean;
};

type AdminInquiryInboxItem = {
  inquiry: {
    id: string;
    message: string;
    preferredContact: PreferredContact;
    phone: string | null;
    createdAt: string;
  };
  listing: {
    id: string;
    type: "car" | "building" | "land";
    title: string;
  };
  buyer: {
    id: string;
    email: string;
  };
  conversationId: string | null;
};

type AdminInquiryInboxPage = {
  data: AdminInquiryInboxItem[];
  page: {
    limit: number;
    next_cursor: string | null;
    has_more: boolean;
  };
};

type InquiryRowForInbox = Pick<Inquiry, "id" | "message" | "preferredContact" | "phone" | "createdAt"> & {
  listingId: string;
  buyerUserId: string;
  listing: {
    id: string;
    type: "car" | "building" | "land";
    title: string;
  };
  buyerUser: {
    id: string;
    email: string;
  };
};

function toIso(value: Date): string {
  return value.toISOString();
}

function buildNextCursorFromInquiry(row: Pick<Inquiry, "id" | "createdAt">): string {
  const cursor: AdminInquiriesCursor = {
    v: 1,
    sort: "createdAt",
    order: "desc",
    val: row.createdAt.toISOString(),
    id: row.id,
  };

  return encodeAdminInquiriesCursor(cursor);
}

async function getSingleActiveAdminUserId(tx: PrismaNamespace.TransactionClient): Promise<string> {
  const admin = await tx.user.findFirst({
    where: {
      role: "admin",
      status: "active",
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
    },
  });

  if (!admin) {
    throw new ApiError(500, "SERVER_MISCONFIG", "Admin user not configured");
  }

  return admin.id;
}

export async function createInquiryAndAutoConversation(
  buyer: AuthenticatedBuyer,
  input: CreateInquiryInput,
): Promise<CreateInquiryResult> {
  return prisma.$transaction(async (tx) => {
    const listing = await tx.listing.findFirst({
      where: {
        id: input.listingId,
        status: "published",
      },
      select: {
        id: true,
      },
    });

    if (!listing) {
      throw new ApiError(404, "NOT_FOUND", "Listing not found");
    }

    const sellerUserId = await getSingleActiveAdminUserId(tx);

    const inquiry = await tx.inquiry.create({
      data: {
        listingId: listing.id,
        buyerUserId: buyer.id,
        message: input.message,
        preferredContact: input.preferredContact,
        ...(input.phone === undefined ? {} : { phone: input.phone }),
      },
      select: {
        id: true,
        listingId: true,
      },
    });

    let conversation = await tx.conversation.findUnique({
      where: {
        buyerUserId_listingId: {
          buyerUserId: buyer.id,
          listingId: listing.id,
        },
      },
      select: {
        id: true,
      },
    });

    let created = false;

    if (!conversation) {
      try {
        conversation = await tx.conversation.create({
          data: {
            listingId: listing.id,
            buyerUserId: buyer.id,
            sellerUserId,
          },
          select: {
            id: true,
          },
        });
        created = true;
      } catch (error) {
        if (
          error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          conversation = await tx.conversation.findUnique({
            where: {
              buyerUserId_listingId: {
                buyerUserId: buyer.id,
                listingId: listing.id,
              },
            },
            select: {
              id: true,
            },
          });
        } else {
          throw error;
        }
      }
    }

    if (!conversation) {
      throw new ApiError(500, "INTERNAL_ERROR", "Failed to create or load conversation");
    }

    const now = new Date();

    await tx.message.create({
      data: {
        conversationId: conversation.id,
        senderUserId: buyer.id,
        kind: "text",
        text: input.message,
      },
      select: {
        id: true,
      },
    });

    await tx.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: now,
      },
      select: {
        id: true,
      },
    });

    return {
      inquiry_id: inquiry.id,
      conversation_id: conversation.id,
      listing_id: inquiry.listingId,
      created,
    };
  });
}

export async function listAdminInquiries(
  _actor: AdminActor,
  query: AdminInquiriesQuery,
): Promise<AdminInquiryInboxPage> {
  const where: PrismaNamespace.InquiryWhereInput = {
    ...(query.listingId ? { listingId: query.listingId } : {}),
  };

  if (query.cursor) {
    const cursorDate = new Date(query.cursor.val);
    where.OR = [
      { createdAt: { lt: cursorDate } },
      {
        createdAt: cursorDate,
        id: { lt: query.cursor.id },
      },
    ];
  }

  const rows = await prisma.inquiry.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    select: {
      id: true,
      listingId: true,
      buyerUserId: true,
      message: true,
      preferredContact: true,
      phone: true,
      createdAt: true,
      listing: {
        select: {
          id: true,
          type: true,
          title: true,
        },
      },
      buyerUser: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  const hasMore = rows.length > query.limit;
  const slice = (hasMore ? rows.slice(0, query.limit) : rows) as InquiryRowForInbox[];

  let conversationIdsByPair = new Map<string, string>();
  if (slice.length > 0) {
    const pairFilters = slice.map((row) => ({
      buyerUserId: row.buyerUserId,
      listingId: row.listingId,
    }));

    const conversations = await prisma.conversation.findMany({
      where: {
        OR: pairFilters,
      },
      select: {
        id: true,
        buyerUserId: true,
        listingId: true,
      },
    });

    conversationIdsByPair = new Map(
      conversations.map((conversation) => [
        `${conversation.buyerUserId}:${conversation.listingId}`,
        conversation.id,
      ]),
    );
  }

  const nextCursor = hasMore ? buildNextCursorFromInquiry(slice[slice.length - 1]!) : null;

  return {
    data: slice.map((row) => ({
      inquiry: {
        id: row.id,
        message: row.message,
        preferredContact: row.preferredContact,
        phone: row.phone ?? null,
        createdAt: toIso(row.createdAt),
      },
      listing: {
        id: row.listing.id,
        type: row.listing.type,
        title: row.listing.title,
      },
      buyer: {
        id: row.buyerUser.id,
        email: row.buyerUser.email,
      },
      conversationId:
        conversationIdsByPair.get(`${row.buyerUserId}:${row.listingId}`) ?? null,
    })),
    page: {
      limit: query.limit,
      next_cursor: nextCursor,
      has_more: hasMore,
    },
  };
}

