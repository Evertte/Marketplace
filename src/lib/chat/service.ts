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
  lastMessagePreview: string | null;
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

type ArchiveConversationResult = {
  conversationId: string;
  archivedAt: string | null;
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
};

function toIso(value: Date): string {
  return value.toISOString();
}

function decimalToString(value: Prisma.Decimal): string {
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
  const roleFilter: Prisma.ConversationWhereInput = {
    participants: {
      some: {
        userId: actor.id,
        archivedAt: query.archived ? { not: null } : null,
      },
    },
  };

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
      messages: {
        take: 1,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          createdAt: true,
          kind: true,
          text: true,
        },
      },
      readStates: {
        where: { userId: actor.id },
        take: 1,
        select: {
          conversationId: true,
          userId: true,
          lastReadMessageId: true,
          lastReadAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
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
      ...(() => {
        const latestMessageAt = row.messages[0]?.createdAt ?? row.lastMessageAt ?? null;
        const myReadState = row.readStates[0] ?? null;
        const hasUnread =
          latestMessageAt !== null &&
          (myReadState?.lastReadAt == null || latestMessageAt > myReadState.lastReadAt);

        return { hasUnread };
      })(),
      conversation: {
        id: row.id,
        listingId: row.listingId,
        buyerUserId: row.buyerUserId,
        sellerUserId: row.sellerUserId,
        lastMessageAt: row.lastMessageAt ? toIso(row.lastMessageAt) : null,
        createdAt: toIso(row.createdAt),
        updatedAt: toIso(row.updatedAt),
      },
      lastMessagePreview: buildLastMessagePreview(row.messages[0] ?? null),
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
    },
    update: {
      archivedAt,
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
