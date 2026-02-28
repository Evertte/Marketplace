import "server-only";

import type { NotificationType, Prisma, User } from "@prisma/client";

import { prisma } from "../db/prisma";
import { ApiError } from "../http/errors";
import { USER_NOTIFICATION_EVENT, getUserNotificationRealtimeTopic, type UserNotificationBroadcastPayload } from "../chat/realtime";
import { getSupabaseAdmin } from "../supabase/server";
import { encodeNotificationsCursor } from "./cursor";
import type { NotificationsListQuery } from "./validators";

type NotificationActor = Pick<User, "id">;

type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  href: string | null;
  data: Prisma.JsonValue | null;
  readAt: string | null;
  createdAt: string;
};

type NotificationsPage = {
  data: NotificationItem[];
  page: {
    limit: number;
    next_cursor: string | null;
    has_more: boolean;
  };
  unreadCount: number;
};

type NotificationMutationResult = {
  id: string;
  readAt: string;
};

function toIso(value: Date): string {
  return value.toISOString();
}

function mapNotification(row: {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string | null;
  href: string | null;
  data: Prisma.JsonValue | null;
  readAt: Date | null;
  createdAt: Date;
}): NotificationItem {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    href: row.href,
    data: row.data,
    readAt: row.readAt ? toIso(row.readAt) : null,
    createdAt: toIso(row.createdAt),
  };
}

async function broadcastUserNotification(payload: UserNotificationBroadcastPayload) {
  try {
    const supabase = getSupabaseAdmin();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!serviceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
    }
    await supabase.realtime.setAuth(serviceRoleKey);
    const channel = supabase.channel(getUserNotificationRealtimeTopic(payload.userId), {
      config: { private: true },
    });
    await channel.httpSend(USER_NOTIFICATION_EVENT, payload);
    void supabase.removeChannel(channel);
  } catch (error) {
    console.error("Failed to broadcast notification", error);
  }
}

export async function createNotificationAndBroadcast(args: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  href?: string | null;
  data?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
}): Promise<NotificationItem> {
  const created = await prisma.notification.create({
    data: {
      userId: args.userId,
      type: args.type,
      title: args.title,
      ...(args.body === undefined ? {} : { body: args.body }),
      ...(args.href === undefined ? {} : { href: args.href }),
      ...(args.data === undefined ? {} : { data: args.data }),
    },
    select: {
      id: true,
      userId: true,
      type: true,
      title: true,
      body: true,
      href: true,
      data: true,
      readAt: true,
      createdAt: true,
    },
  });

  const mapped = mapNotification(created);
  await broadcastUserNotification({
    id: mapped.id,
    userId: args.userId,
    type: mapped.type,
    title: mapped.title,
    body: mapped.body,
    href: mapped.href,
    data: mapped.data,
    readAt: mapped.readAt,
    createdAt: mapped.createdAt,
  });
  return mapped;
}

function buildCursorWhere(cursor: NonNullable<NotificationsListQuery["cursor"]>): Prisma.NotificationWhereInput {
  const createdAt = new Date(cursor.val);
  return {
    OR: [
      { createdAt: { lt: createdAt } },
      { createdAt, id: { lt: cursor.id } },
    ],
  };
}

function buildNextCursor(last: { id: string; createdAt: Date }): string {
  return encodeNotificationsCursor({
    v: 1,
    sort: "createdAt",
    order: "desc",
    val: toIso(last.createdAt),
    id: last.id,
  });
}

export async function listNotificationsForUser(actor: NotificationActor, query: NotificationsListQuery): Promise<NotificationsPage> {
  const where = { userId: actor.id } satisfies Prisma.NotificationWhereInput;
  const cursorWhere = query.cursor ? buildCursorWhere(query.cursor) : undefined;
  const [rows, unreadCount] = await prisma.$transaction([
    prisma.notification.findMany({
      where: cursorWhere ? { AND: [where, cursorWhere] } : where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      select: {
        id: true,
        userId: true,
        type: true,
        title: true,
        body: true,
        href: true,
        data: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({
      where: {
        userId: actor.id,
        readAt: null,
      },
    }),
  ]);

  const hasMore = rows.length > query.limit;
  const slice = hasMore ? rows.slice(0, query.limit) : rows;
  const nextCursor = hasMore ? buildNextCursor(slice[slice.length - 1]!) : null;

  return {
    data: slice.map(mapNotification),
    page: {
      limit: query.limit,
      next_cursor: nextCursor,
      has_more: hasMore,
    },
    unreadCount,
  };
}

export async function markNotificationReadForUser(actor: NotificationActor, notificationId: string): Promise<NotificationMutationResult> {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: {
      id: true,
      userId: true,
    },
  });
  if (!notification) {
    throw new ApiError(404, "NOT_FOUND", "Notification not found");
  }
  if (notification.userId !== actor.id) {
    throw new ApiError(403, "FORBIDDEN", "Not allowed to update this notification");
  }

  const readAt = new Date();
  await prisma.notification.update({
    where: { id: notification.id },
    data: { readAt },
    select: { id: true },
  });
  return { id: notification.id, readAt: toIso(readAt) };
}

export async function markAllNotificationsReadForUser(actor: NotificationActor): Promise<{ readAt: string }> {
  const readAt = new Date();
  await prisma.notification.updateMany({
    where: {
      userId: actor.id,
      readAt: null,
    },
    data: { readAt },
  });
  return { readAt: toIso(readAt) };
}
