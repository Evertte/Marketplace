import type {
  ListingType,
  MessageKind,
  Prisma,
  User,
} from "@prisma/client";

import { prisma } from "../db/prisma";
import { ApiError } from "../http/errors";
import {
  encodeConversationMessagesCursor,
  encodeConversationsCursor,
  type ConversationMessagesCursor,
  type ConversationsCursor,
} from "./cursor";
import type {
  ConversationMessagesListQuery,
  ConversationsListQuery,
  CreateTextMessageInput,
} from "./validators";

type ChatActor = Pick<User, "id" | "role" | "status">;

type ConversationListItem = {
  conversation: {
    id: string;
    listingId: string;
    buyerUserId: string;
    sellerUserId: string;
    lastMessageAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  listing: {
    id: string;
    type: ListingType;
    title: string;
    price: string;
    currency: string;
    locationCountry: string;
    locationRegion: string;
    locationCity: string;
    coverImageUrl: string | null;
  };
  buyer: {
    id: string;
    email: string;
  };
};

type ConversationsListPage = {
  data: ConversationListItem[];
  page: {
    limit: number;
    next_cursor: string | null;
    has_more: boolean;
  };
};

type ConversationMessageItem = {
  id: string;
  conversationId: string;
  senderUserId: string;
  kind: MessageKind;
  text: string | null;
  media: null | {
    id: string;
    url: string;
    thumbUrl: string | null;
    kind: "image" | "video";
  };
  createdAt: string;
};

type ConversationMessagesPage = {
  data: ConversationMessageItem[];
  page: {
    limit: number;
    next_cursor: string | null;
    has_more: boolean;
  };
};

type CreateConversationMessageResult = {
  message_id: string;
  createdAt: string;
};

function toIso(value: Date): string {
  return value.toISOString();
}

function decimalToString(value: Prisma.Decimal): string {
  return value.toString();
}

type ConversationMembership = {
  id: string;
  buyerUserId: string;
  sellerUserId: string;
};

async function getConversationMembership(
  conversationId: string,
): Promise<ConversationMembership> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      buyerUserId: true,
      sellerUserId: true,
    },
  });

  if (!conversation) {
    throw new ApiError(404, "NOT_FOUND", "Conversation not found");
  }

  return conversation;
}

function assertConversationAccess(
  actor: ChatActor,
  conversation: ConversationMembership,
): void {
  if (actor.id !== conversation.buyerUserId && actor.id !== conversation.sellerUserId) {
    throw new ApiError(403, "FORBIDDEN", "Not allowed to access this conversation");
  }
}

function buildConversationCursorWhere(
  cursor: ConversationsCursor | undefined,
): Prisma.ConversationWhereInput | undefined {
  if (!cursor) return undefined;

  const cursorCreatedAt = new Date(cursor.createdAt);

  if (cursor.lastMessageAt === null) {
    return {
      lastMessageAt: null,
      OR: [
        { createdAt: { lt: cursorCreatedAt } },
        { createdAt: cursorCreatedAt, id: { lt: cursor.id } },
      ],
    };
  }

  const cursorLastMessageAt = new Date(cursor.lastMessageAt);

  return {
    OR: [
      { lastMessageAt: { lt: cursorLastMessageAt } },
      {
        lastMessageAt: cursorLastMessageAt,
        createdAt: { lt: cursorCreatedAt },
      },
      {
        lastMessageAt: cursorLastMessageAt,
        createdAt: cursorCreatedAt,
        id: { lt: cursor.id },
      },
      { lastMessageAt: null },
    ],
  };
}

function buildConversationsNextCursor(last: {
  id: string;
  lastMessageAt: Date | null;
  createdAt: Date;
}): string {
  const cursor: ConversationsCursor = {
    v: 1,
    sort: "activity",
    order: "desc",
    lastMessageAt: last.lastMessageAt ? toIso(last.lastMessageAt) : null,
    createdAt: toIso(last.createdAt),
    id: last.id,
  };

  return encodeConversationsCursor(cursor);
}

export async function listUserConversations(
  actor: ChatActor,
  query: ConversationsListQuery,
): Promise<ConversationsListPage> {
  const roleFilter: Prisma.ConversationWhereInput =
    actor.role === "admin"
      ? { sellerUserId: actor.id }
      : { buyerUserId: actor.id };

  const cursorWhere = buildConversationCursorWhere(query.cursor);

  const rows = await prisma.conversation.findMany({
    where: cursorWhere ? { AND: [roleFilter, cursorWhere] } : roleFilter,
    orderBy: [
      { lastMessageAt: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
      { id: "desc" },
    ],
    take: query.limit + 1,
    select: {
      id: true,
      listingId: true,
      buyerUserId: true,
      sellerUserId: true,
      lastMessageAt: true,
      createdAt: true,
      updatedAt: true,
      buyerUser: {
        select: {
          id: true,
          email: true,
        },
      },
      listing: {
        select: {
          id: true,
          type: true,
          title: true,
          price: true,
          currency: true,
          locationCountry: true,
          locationRegion: true,
          locationCity: true,
          listingMedia: {
            take: 1,
            orderBy: [{ sortOrder: "asc" }, { mediaId: "asc" }],
            select: {
              media: {
                select: {
                  url: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const hasMore = rows.length > query.limit;
  const slice = hasMore ? rows.slice(0, query.limit) : rows;
  const nextCursor = hasMore ? buildConversationsNextCursor(slice[slice.length - 1]!) : null;

  return {
    data: slice.map((row) => ({
      conversation: {
        id: row.id,
        listingId: row.listingId,
        buyerUserId: row.buyerUserId,
        sellerUserId: row.sellerUserId,
        lastMessageAt: row.lastMessageAt ? toIso(row.lastMessageAt) : null,
        createdAt: toIso(row.createdAt),
        updatedAt: toIso(row.updatedAt),
      },
      listing: {
        id: row.listing.id,
        type: row.listing.type,
        title: row.listing.title,
        price: decimalToString(row.listing.price),
        currency: row.listing.currency,
        locationCountry: row.listing.locationCountry,
        locationRegion: row.listing.locationRegion,
        locationCity: row.listing.locationCity,
        coverImageUrl: row.listing.listingMedia[0]?.media.url ?? null,
      },
      buyer: {
        id: row.buyerUser.id,
        email: row.buyerUser.email,
      },
    })),
    page: {
      limit: query.limit,
      next_cursor: nextCursor,
      has_more: hasMore,
    },
  };
}

function buildMessagesCursorWhere(
  cursor: ConversationMessagesCursor | undefined,
): Prisma.MessageWhereInput | undefined {
  if (!cursor) return undefined;

  const createdAt = new Date(cursor.val);
  return {
    OR: [
      { createdAt: { lt: createdAt } },
      { createdAt, id: { lt: cursor.id } },
    ],
  };
}

function buildMessagesNextCursor(last: { id: string; createdAt: Date }): string {
  const cursor: ConversationMessagesCursor = {
    v: 1,
    sort: "createdAt",
    order: "desc",
    val: toIso(last.createdAt),
    id: last.id,
  };

  return encodeConversationMessagesCursor(cursor);
}

export async function listConversationMessagesForUser(
  actor: ChatActor,
  conversationId: string,
  query: ConversationMessagesListQuery,
): Promise<ConversationMessagesPage> {
  const conversation = await getConversationMembership(conversationId);
  assertConversationAccess(actor, conversation);

  const cursorWhere = buildMessagesCursorWhere(query.cursor);
  const rows = await prisma.message.findMany({
    where: cursorWhere
      ? { AND: [{ conversationId: conversation.id }, cursorWhere] }
      : { conversationId: conversation.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    select: {
      id: true,
      conversationId: true,
      senderUserId: true,
      kind: true,
      text: true,
      createdAt: true,
      media: {
        select: {
          id: true,
          url: true,
          thumbUrl: true,
          kind: true,
        },
      },
    },
  });

  const hasMore = rows.length > query.limit;
  const slice = hasMore ? rows.slice(0, query.limit) : rows;
  const nextCursor = hasMore ? buildMessagesNextCursor(slice[slice.length - 1]!) : null;

  return {
    data: slice.map((row) => ({
      id: row.id,
      conversationId: row.conversationId,
      senderUserId: row.senderUserId,
      kind: row.kind,
      text: row.text ?? null,
      media: row.media
        ? {
            id: row.media.id,
            url: row.media.url,
            thumbUrl: row.media.thumbUrl ?? null,
            kind: row.media.kind,
          }
        : null,
      createdAt: toIso(row.createdAt),
    })),
    page: {
      limit: query.limit,
      next_cursor: nextCursor,
      has_more: hasMore,
    },
  };
}

export async function createConversationTextMessageForUser(
  actor: ChatActor,
  conversationId: string,
  input: CreateTextMessageInput,
): Promise<CreateConversationMessageResult> {
  const conversation = await getConversationMembership(conversationId);
  assertConversationAccess(actor, conversation);

  const created = await prisma.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: {
        conversationId: conversation.id,
        senderUserId: actor.id,
        kind: "text",
        text: input.text,
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    await tx.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: message.createdAt,
      },
      select: {
        id: true,
      },
    });

    return message;
  });

  return {
    message_id: created.id,
    createdAt: toIso(created.createdAt),
  };
}
