import type {
  ListingType,
  MessageKind,
  Prisma,
  User,
} from "@prisma/client";
import { Prisma as PrismaNamespace } from "@prisma/client";

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

type ConversationReadStateDto = {
  conversationId: string;
  userId: string;
  lastReadMessageId: string | null;
  lastReadAt: string | null;
  createdAt: string;
  updatedAt: string;
};

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
  hasUnread: boolean;
  unreadCount: number;
  lastMessagePreview: string | null;
  lastMessageSenderId: string | null;
  isPinned: boolean;
  pinnedAt: string | null;
  otherUser: {
    id: string;
    name: string;
    avatarUrl: string | null;
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
};

type ConversationsListPage = {
  data: ConversationListItem[];
  page: {
    limit: number;
    next_cursor: string | null;
    has_more: boolean;
  };
};

type ArchiveConversationResult = {
  conversationId: string;
  archivedAt: string | null;
};

type PinConversationResult = {
  conversationId: string;
  pinnedAt: string | null;
};

type PurgeConversationResult = {
  conversationId: string;
  purged: true;
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
  readState: {
    me: ConversationReadStateDto | null;
    other: ConversationReadStateDto | null;
  };
};

type CreateConversationMessageResult = {
  message_id: string;
  createdAt: string;
  recipientUserId: string;
  preview: string | null;
};

function toIso(value: Date): string {
  return value.toISOString();
}

function decimalToString(value: Prisma.Decimal): string {
  return value.toString();
}

function numericToString(value: Prisma.Decimal | string | number): string {
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return value.toString();
}

function buildLastMessagePreview(message: {
  kind: MessageKind;
  text: string | null;
} | null): string | null {
  if (!message) return null;

  if (message.kind === "media") {
    return "Media attachment";
  }

  const text = message.text?.trim();
  if (!text) return null;
  if (text.length <= 100) return text;
  return `${text.slice(0, 97)}...`;
}

function buildLastMessagePreviewText(args: {
  kind: MessageKind | null;
  text: string | null;
  senderUserId: string | null;
  actorId: string;
}): string | null {
  const preview = buildLastMessagePreview(
    args.kind
      ? {
          kind: args.kind,
          text: args.text,
        }
      : null,
  );

  if (!preview) return null;
  return args.senderUserId === args.actorId ? `You: ${preview}` : preview;
}

function mapConversationReadState(
  state: {
    conversationId: string;
    userId: string;
    lastReadMessageId: string | null;
    lastReadAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  } | null,
): ConversationReadStateDto | null {
  if (!state) return null;

  return {
    conversationId: state.conversationId,
    userId: state.userId,
    lastReadMessageId: state.lastReadMessageId ?? null,
    lastReadAt: state.lastReadAt ? toIso(state.lastReadAt) : null,
    createdAt: toIso(state.createdAt),
    updatedAt: toIso(state.updatedAt),
  };
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

function assertActiveActor(actor: ChatActor): void {
  if (actor.status === "banned") {
    throw new ApiError(403, "USER_BANNED", "User account is banned");
  }
}

function buildConversationCursorWhere(
  cursor: ConversationsCursor | undefined,
): Prisma.Sql {
  if (!cursor) return PrismaNamespace.empty;

  const activityExpr = PrismaNamespace.sql`COALESCE(lm."createdAt", c."lastMessageAt", c."createdAt")`;
  const cursorActivityAt = new Date(cursor.activityAt);

  if (cursor.pinnedAt === null) {
    return PrismaNamespace.sql`
      AND cp."pinnedAt" IS NULL
      AND (
        ${activityExpr} < ${cursorActivityAt}
        OR (${activityExpr} = ${cursorActivityAt} AND c.id < ${cursor.id}::uuid)
      )
    `;
  }

  const cursorPinnedAt = new Date(cursor.pinnedAt);
  return PrismaNamespace.sql`
    AND (
      cp."pinnedAt" IS NULL
      OR cp."pinnedAt" < ${cursorPinnedAt}
      OR (
        cp."pinnedAt" = ${cursorPinnedAt}
        AND (
          ${activityExpr} < ${cursorActivityAt}
          OR (${activityExpr} = ${cursorActivityAt} AND c.id < ${cursor.id}::uuid)
        )
      )
    )
  `;
}

function buildConversationsNextCursor(last: {
  id: string;
  pinnedAt: Date | null;
  activityAt: Date;
}): string {
  const cursor: ConversationsCursor = {
    v: 1,
    sort: "activity",
    order: "desc",
    pinnedAt: last.pinnedAt ? toIso(last.pinnedAt) : null,
    activityAt: toIso(last.activityAt),
    id: last.id,
  };

  return encodeConversationsCursor(cursor);
}

type ConversationInboxRow = {
  conversationId: string;
  listingId: string;
  buyerUserId: string;
  sellerUserId: string;
  conversationCreatedAt: Date;
  conversationUpdatedAt: Date;
  lastMessageAt: Date | null;
  pinnedAt: Date | null;
  activityAt: Date;
  lastMessageSenderId: string | null;
  lastMessageKind: MessageKind | null;
  lastMessageText: string | null;
  unreadCount: number;
  listingType: ListingType;
  listingTitle: string;
  listingPrice: Prisma.Decimal | string | number;
  listingCurrency: string;
  locationCountry: string;
  locationRegion: string;
  locationCity: string;
  coverImageUrl: string | null;
  buyerEmail: string;
  sellerEmail: string;
};

export async function listUserConversations(
  actor: ChatActor,
  query: ConversationsListQuery,
): Promise<ConversationsListPage> {
  const archivedFilter = query.archived
    ? PrismaNamespace.sql`cp."archivedAt" IS NOT NULL`
    : PrismaNamespace.sql`cp."archivedAt" IS NULL`;
  const cursorWhere = buildConversationCursorWhere(query.cursor);

  const rows = await prisma.$queryRaw<ConversationInboxRow[]>(PrismaNamespace.sql`
    SELECT
      c.id AS "conversationId",
      c."listingId" AS "listingId",
      c."buyerUserId" AS "buyerUserId",
      c."sellerUserId" AS "sellerUserId",
      c."createdAt" AS "conversationCreatedAt",
      c."updatedAt" AS "conversationUpdatedAt",
      c."lastMessageAt" AS "lastMessageAt",
      cp."pinnedAt" AS "pinnedAt",
      COALESCE(lm."createdAt", c."lastMessageAt", c."createdAt") AS "activityAt",
      lm."senderUserId" AS "lastMessageSenderId",
      lm.kind AS "lastMessageKind",
      lm.text AS "lastMessageText",
      COALESCE(unread."unreadCount", 0)::int AS "unreadCount",
      l.type AS "listingType",
      l.title AS "listingTitle",
      l.price AS "listingPrice",
      l.currency AS "listingCurrency",
      l."locationCountry" AS "locationCountry",
      l."locationRegion" AS "locationRegion",
      l."locationCity" AS "locationCity",
      hero.url AS "coverImageUrl",
      buyer.email AS "buyerEmail",
      seller.email AS "sellerEmail"
    FROM "ConversationParticipant" cp
    JOIN "Conversation" c
      ON c.id = cp."conversationId"
    JOIN "Listing" l
      ON l.id = c."listingId"
    JOIN "User" buyer
      ON buyer.id = c."buyerUserId"
    JOIN "User" seller
      ON seller.id = c."sellerUserId"
    LEFT JOIN LATERAL (
      SELECT
        m."createdAt",
        m."senderUserId",
        m.kind,
        m.text
      FROM "Message" m
      WHERE m."conversationId" = c.id
      ORDER BY m."createdAt" DESC, m.id DESC
      LIMIT 1
    ) lm ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS "unreadCount"
      FROM "Message" m
      LEFT JOIN "ConversationReadState" rs
        ON rs."conversationId" = c.id
       AND rs."userId" = ${actor.id}::uuid
      WHERE m."conversationId" = c.id
        AND m."senderUserId" <> ${actor.id}::uuid
        AND (rs."lastReadAt" IS NULL OR m."createdAt" > rs."lastReadAt")
    ) unread ON true
    LEFT JOIN LATERAL (
      SELECT media.url
      FROM "ListingMedia" listing_media
      JOIN "Media" media
        ON media.id = listing_media."mediaId"
      WHERE listing_media."listingId" = l.id
      ORDER BY listing_media."sortOrder" ASC, listing_media."mediaId" ASC
      LIMIT 1
    ) hero ON true
    WHERE cp."userId" = ${actor.id}::uuid
      AND ${archivedFilter}
      ${cursorWhere}
    ORDER BY
      (cp."pinnedAt" IS NOT NULL) DESC,
      cp."pinnedAt" DESC NULLS LAST,
      COALESCE(lm."createdAt", c."lastMessageAt", c."createdAt") DESC,
      c.id DESC
    LIMIT ${query.limit + 1}
  `);

  const hasMore = rows.length > query.limit;
  const slice = hasMore ? rows.slice(0, query.limit) : rows;
  const nextCursor = hasMore
    ? buildConversationsNextCursor({
        id: slice[slice.length - 1]!.conversationId,
        pinnedAt: slice[slice.length - 1]!.pinnedAt,
        activityAt: slice[slice.length - 1]!.activityAt,
      })
    : null;

  return {
    data: slice.map((row) => ({
      conversation: {
        id: row.conversationId,
        listingId: row.listingId,
        buyerUserId: row.buyerUserId,
        sellerUserId: row.sellerUserId,
        lastMessageAt: row.lastMessageAt ? toIso(row.lastMessageAt) : null,
        createdAt: toIso(row.conversationCreatedAt),
        updatedAt: toIso(row.conversationUpdatedAt),
      },
      hasUnread: row.unreadCount > 0,
      unreadCount: row.unreadCount,
      lastMessagePreview: buildLastMessagePreviewText({
        kind: row.lastMessageKind,
        text: row.lastMessageText,
        senderUserId: row.lastMessageSenderId,
        actorId: actor.id,
      }),
      lastMessageSenderId: row.lastMessageSenderId,
      isPinned: row.pinnedAt !== null,
      pinnedAt: row.pinnedAt ? toIso(row.pinnedAt) : null,
      otherUser: {
        id: actor.role === "admin" ? row.buyerUserId : row.sellerUserId,
        name: actor.role === "admin" ? row.buyerEmail : "Marketplace Admin",
        avatarUrl: null,
      },
      listing: {
        id: row.listingId,
        type: row.listingType,
        title: row.listingTitle,
        price: numericToString(row.listingPrice),
        currency: row.listingCurrency,
        locationCountry: row.locationCountry,
        locationRegion: row.locationRegion,
        locationCity: row.locationCity,
        coverImageUrl: row.coverImageUrl,
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
  const [rows, readStates] = await prisma.$transaction([
    prisma.message.findMany({
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
    }),
    prisma.conversationReadState.findMany({
      where: {
        conversationId: conversation.id,
        userId: {
          in: [conversation.buyerUserId, conversation.sellerUserId],
        },
      },
      select: {
        conversationId: true,
        userId: true,
        lastReadMessageId: true,
        lastReadAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const hasMore = rows.length > query.limit;
  const slice = hasMore ? rows.slice(0, query.limit) : rows;
  const nextCursor = hasMore ? buildMessagesNextCursor(slice[slice.length - 1]!) : null;
  const myReadState = readStates.find((state) => state.userId === actor.id) ?? null;
  const otherReadState =
    readStates.find((state) => state.userId !== actor.id) ?? null;

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
    readState: {
      me: mapConversationReadState(myReadState),
      other: mapConversationReadState(otherReadState),
    },
  };
}

export async function createConversationTextMessageForUser(
  actor: ChatActor,
  conversationId: string,
  input: CreateTextMessageInput,
): Promise<CreateConversationMessageResult> {
  assertActiveActor(actor);
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
    recipientUserId:
      actor.id === conversation.buyerUserId ? conversation.sellerUserId : conversation.buyerUserId,
    preview: buildLastMessagePreview({
      kind: "text",
      text: input.text,
    }),
  };
}

export async function markConversationReadForUser(
  actor: ChatActor,
  conversationId: string,
): Promise<ConversationReadStateDto> {
  const conversation = await getConversationMembership(conversationId);
  assertConversationAccess(actor, conversation);

  const latestMessage = await prisma.message.findFirst({
    where: { conversationId: conversation.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
    },
  });

  const now = new Date();
  const state = await prisma.conversationReadState.upsert({
    where: {
      conversationId_userId: {
        conversationId: conversation.id,
        userId: actor.id,
      },
    },
    create: {
      conversationId: conversation.id,
      userId: actor.id,
      lastReadMessageId: latestMessage?.id ?? null,
      lastReadAt: now,
    },
    update: {
      lastReadMessageId: latestMessage?.id ?? null,
      lastReadAt: now,
    },
    select: {
      conversationId: true,
      userId: true,
      lastReadMessageId: true,
      lastReadAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return mapConversationReadState(state)!;
}

export async function archiveConversationForUser(
  actor: ChatActor,
  conversationId: string,
): Promise<ArchiveConversationResult> {
  const conversation = await getConversationMembership(conversationId);
  assertConversationAccess(actor, conversation);

  const archivedAt = new Date();
  await prisma.conversationParticipant.upsert({
    where: {
      conversationId_userId: {
        conversationId: conversation.id,
        userId: actor.id,
      },
    },
    create: {
      conversationId: conversation.id,
      userId: actor.id,
      role: actor.id === conversation.buyerUserId ? "buyer" : "seller",
      archivedAt,
      pinnedAt: null,
    },
    update: {
      archivedAt,
      pinnedAt: null,
    },
    select: {
      id: true,
    },
  });

  return {
    conversationId: conversation.id,
    archivedAt: toIso(archivedAt),
  };
}

export async function unarchiveConversationForUser(
  actor: ChatActor,
  conversationId: string,
): Promise<ArchiveConversationResult> {
  const conversation = await getConversationMembership(conversationId);
  assertConversationAccess(actor, conversation);

  await prisma.conversationParticipant.upsert({
    where: {
      conversationId_userId: {
        conversationId: conversation.id,
        userId: actor.id,
      },
    },
    create: {
      conversationId: conversation.id,
      userId: actor.id,
      role: actor.id === conversation.buyerUserId ? "buyer" : "seller",
      archivedAt: null,
    },
    update: {
      archivedAt: null,
    },
    select: {
      id: true,
    },
  });

  return {
    conversationId: conversation.id,
    archivedAt: null,
  };
}

export async function pinConversationForUser(
  actor: ChatActor,
  conversationId: string,
): Promise<PinConversationResult> {
  const conversation = await getConversationMembership(conversationId);
  assertConversationAccess(actor, conversation);

  const pinnedAt = new Date();
  await prisma.conversationParticipant.upsert({
    where: {
      conversationId_userId: {
        conversationId: conversation.id,
        userId: actor.id,
      },
    },
    create: {
      conversationId: conversation.id,
      userId: actor.id,
      role: actor.id === conversation.buyerUserId ? "buyer" : "seller",
      archivedAt: null,
      pinnedAt,
    },
    update: {
      archivedAt: null,
      pinnedAt,
    },
    select: { id: true },
  });

  return {
    conversationId: conversation.id,
    pinnedAt: toIso(pinnedAt),
  };
}

export async function unpinConversationForUser(
  actor: ChatActor,
  conversationId: string,
): Promise<PinConversationResult> {
  const conversation = await getConversationMembership(conversationId);
  assertConversationAccess(actor, conversation);

  await prisma.conversationParticipant.upsert({
    where: {
      conversationId_userId: {
        conversationId: conversation.id,
        userId: actor.id,
      },
    },
    create: {
      conversationId: conversation.id,
      userId: actor.id,
      role: actor.id === conversation.buyerUserId ? "buyer" : "seller",
      archivedAt: null,
      pinnedAt: null,
    },
    update: {
      pinnedAt: null,
    },
    select: { id: true },
  });

  return {
    conversationId: conversation.id,
    pinnedAt: null,
  };
}

export async function purgeConversationAsAdmin(
  actor: ChatActor,
  conversationId: string,
): Promise<PurgeConversationResult> {
  if (actor.role !== "admin") {
    throw new ApiError(403, "FORBIDDEN", "Admin access required");
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      participants: {
        where: {
          archivedAt: {
            not: null,
          },
        },
        take: 1,
        select: {
          id: true,
        },
      },
    },
  });

  if (!conversation) {
    throw new ApiError(404, "NOT_FOUND", "Conversation not found");
  }

  if (conversation.participants.length === 0) {
    throw new ApiError(400, "INVALID_STATE", "Conversation must be archived before purge");
  }

  await prisma.$transaction(async (tx) => {
    // TODO: block purge when reports/disputes are added.
    await tx.message.deleteMany({
      where: { conversationId: conversation.id },
    });
    await tx.conversationReadState.deleteMany({
      where: { conversationId: conversation.id },
    });
    await tx.conversationParticipant.deleteMany({
      where: { conversationId: conversation.id },
    });
    await tx.conversation.delete({
      where: { id: conversation.id },
    });
  });

  return {
    conversationId: conversation.id,
    purged: true,
  };
}
