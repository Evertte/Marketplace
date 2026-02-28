import type { Prisma, ReportReason, ReportStatus, User } from "@prisma/client";

import { prisma } from "../db/prisma";
import { ApiError } from "../http/errors";
import type {
  AdminReportsQuery,
  BanUserInput,
  CreateReportInput,
  UpdateReportInput,
} from "./validators";

type ModerationActor = Pick<User, "id" | "role" | "status">;

type ReportSummary = {
  id: string;
  reason: ReportReason;
  note: string | null;
  adminNote: string | null;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
};

type CreateReportResult = {
  id: string;
  status: ReportStatus;
};

type AdminReportListItem = {
  report: ReportSummary & {
    conversationId: string;
    messageId: string | null;
  };
  reporter: {
    id: string;
    email: string;
    status: "active" | "banned";
  };
  reported: {
    id: string;
    email: string;
    status: "active" | "banned";
  };
  conversation: {
    id: string;
    listingId: string;
    listingTitle: string;
  };
  messageSnippet: string | null;
};

type AdminReportsListResult = {
  data: AdminReportListItem[];
};

type AdminReportDetailResult = {
  data: {
    report: ReportSummary & {
      conversationId: string;
      messageId: string | null;
    };
    reporter: {
      id: string;
      email: string;
      status: "active" | "banned";
    };
    reported: {
      id: string;
      email: string;
      status: "active" | "banned";
    };
    conversation: {
      id: string;
      listingId: string;
      listingTitle: string;
      buyerUserId: string;
      sellerUserId: string;
    };
    messages: Array<{
      id: string;
      senderUserId: string;
      text: string | null;
      kind: "text" | "media";
      createdAt: string;
      isReportedTarget: boolean;
    }>;
  };
};

type UpdateReportResult = {
  id: string;
  status: ReportStatus;
  adminNote: string | null;
  updatedAt: string;
};

type BanMutationResult = {
  userId: string;
  status: "active" | "banned";
};

function toIso(value: Date): string {
  return value.toISOString();
}

function assertAdmin(actor: ModerationActor): void {
  if (actor.role !== "admin") {
    throw new ApiError(403, "FORBIDDEN", "Admin access required");
  }
}

function assertActive(actor: ModerationActor): void {
  if (actor.status === "banned") {
    throw new ApiError(403, "USER_BANNED", "User account is banned");
  }
}

function buildMessageSnippet(message: { kind: "text" | "media"; text: string | null } | null): string | null {
  if (!message) return null;
  if (message.kind === "media") return "Media attachment";
  const text = message.text?.trim();
  if (!text) return null;
  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
}

async function getConversationForParticipant(conversationId: string, actorId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      buyerUserId: true,
      sellerUserId: true,
      listingId: true,
      listing: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  if (!conversation) {
    throw new ApiError(404, "NOT_FOUND", "Conversation not found");
  }

  if (conversation.buyerUserId !== actorId && conversation.sellerUserId !== actorId) {
    throw new ApiError(403, "FORBIDDEN", "Not allowed to access this conversation");
  }

  return conversation;
}

async function getReportOrThrow(reportId: string) {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      reason: true,
      note: true,
      adminNote: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      conversationId: true,
      messageId: true,
      reporterUser: {
        select: {
          id: true,
          email: true,
          status: true,
        },
      },
      reportedUser: {
        select: {
          id: true,
          email: true,
          status: true,
        },
      },
      conversation: {
        select: {
          id: true,
          listingId: true,
          buyerUserId: true,
          sellerUserId: true,
          listing: {
            select: {
              title: true,
            },
          },
        },
      },
      message: {
        select: {
          id: true,
          kind: true,
          text: true,
          createdAt: true,
        },
      },
    },
  });

  if (!report) {
    throw new ApiError(404, "NOT_FOUND", "Report not found");
  }

  return report;
}

export async function createReport(
  actor: ModerationActor,
  input: CreateReportInput,
): Promise<CreateReportResult> {
  assertActive(actor);
  const conversation = await getConversationForParticipant(input.conversationId, actor.id);

  let reportedUserId: string;
  if (input.messageId) {
    const message = await prisma.message.findFirst({
      where: {
        id: input.messageId,
        conversationId: conversation.id,
      },
      select: {
        id: true,
        senderUserId: true,
      },
    });

    if (!message) {
      throw new ApiError(404, "NOT_FOUND", "Message not found");
    }

    reportedUserId = message.senderUserId;
  } else {
    reportedUserId = conversation.buyerUserId === actor.id
      ? conversation.sellerUserId
      : conversation.buyerUserId;
  }

  if (reportedUserId === actor.id) {
    throw new ApiError(400, "INVALID_INPUT", "You cannot report yourself");
  }

  const report = await prisma.report.create({
    data: {
      reporterUserId: actor.id,
      reportedUserId,
      conversationId: conversation.id,
      ...(input.messageId ? { messageId: input.messageId } : {}),
      reason: input.reason,
      ...(input.note ? { note: input.note } : {}),
      status: "open",
    },
    select: {
      id: true,
      status: true,
    },
  });

  return report;
}

export async function listAdminReports(
  actor: ModerationActor,
  query: AdminReportsQuery,
): Promise<AdminReportsListResult> {
  assertAdmin(actor);

  const rows = await prisma.report.findMany({
    where: query.status ? { status: query.status } : undefined,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      reason: true,
      note: true,
      adminNote: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      conversationId: true,
      messageId: true,
      reporterUser: {
        select: {
          id: true,
          email: true,
          status: true,
        },
      },
      reportedUser: {
        select: {
          id: true,
          email: true,
          status: true,
        },
      },
      conversation: {
        select: {
          id: true,
          listingId: true,
          listing: {
            select: {
              title: true,
            },
          },
        },
      },
      message: {
        select: {
          kind: true,
          text: true,
        },
      },
    },
  });

  return {
    data: rows.map((row) => ({
      report: {
        id: row.id,
        reason: row.reason,
        note: row.note,
        adminNote: row.adminNote,
        status: row.status,
        createdAt: toIso(row.createdAt),
        updatedAt: toIso(row.updatedAt),
        conversationId: row.conversationId,
        messageId: row.messageId,
      },
      reporter: row.reporterUser,
      reported: row.reportedUser,
      conversation: {
        id: row.conversation.id,
        listingId: row.conversation.listingId,
        listingTitle: row.conversation.listing.title,
      },
      messageSnippet: buildMessageSnippet(row.message),
    })),
  };
}

async function loadReportContextMessages(report: Awaited<ReturnType<typeof getReportOrThrow>>) {
  if (!report.message) {
    const latest = await prisma.message.findMany({
      where: { conversationId: report.conversationId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 30,
      select: {
        id: true,
        senderUserId: true,
        text: true,
        kind: true,
        createdAt: true,
      },
    });

    return [...latest].reverse();
  }

  const target = report.message;
  const [before, after] = await prisma.$transaction([
    prisma.message.findMany({
      where: {
        conversationId: report.conversationId,
        OR: [
          { createdAt: { lt: target.createdAt } },
          { createdAt: target.createdAt, id: { lte: target.id } },
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 15,
      select: {
        id: true,
        senderUserId: true,
        text: true,
        kind: true,
        createdAt: true,
      },
    }),
    prisma.message.findMany({
      where: {
        conversationId: report.conversationId,
        OR: [
          { createdAt: { gt: target.createdAt } },
          { createdAt: target.createdAt, id: { gt: target.id } },
        ],
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 15,
      select: {
        id: true,
        senderUserId: true,
        text: true,
        kind: true,
        createdAt: true,
      },
    }),
  ]);

  return [...before.reverse(), ...after].slice(0, 30);
}

export async function getAdminReportDetail(
  actor: ModerationActor,
  reportId: string,
): Promise<AdminReportDetailResult> {
  assertAdmin(actor);
  const report = await getReportOrThrow(reportId);
  const messages = await loadReportContextMessages(report);

  return {
    data: {
      report: {
        id: report.id,
        reason: report.reason,
        note: report.note,
        adminNote: report.adminNote,
        status: report.status,
        createdAt: toIso(report.createdAt),
        updatedAt: toIso(report.updatedAt),
        conversationId: report.conversationId,
        messageId: report.messageId,
      },
      reporter: report.reporterUser,
      reported: report.reportedUser,
      conversation: {
        id: report.conversation.id,
        listingId: report.conversation.listingId,
        listingTitle: report.conversation.listing.title,
        buyerUserId: report.conversation.buyerUserId,
        sellerUserId: report.conversation.sellerUserId,
      },
      messages: messages.map((message) => ({
        id: message.id,
        senderUserId: message.senderUserId,
        text: message.text,
        kind: message.kind,
        createdAt: toIso(message.createdAt),
        isReportedTarget: message.id === report.messageId,
      })),
    },
  };
}

export async function updateAdminReport(
  actor: ModerationActor,
  reportId: string,
  input: UpdateReportInput,
): Promise<UpdateReportResult> {
  assertAdmin(actor);
  await getReportOrThrow(reportId);

  const updated = await prisma.report.update({
    where: { id: reportId },
    data: {
      status: input.status,
      ...(input.adminNote !== undefined ? { adminNote: input.adminNote || null } : {}),
    },
    select: {
      id: true,
      status: true,
      adminNote: true,
      updatedAt: true,
    },
  });

  return {
    id: updated.id,
    status: updated.status,
    adminNote: updated.adminNote,
    updatedAt: toIso(updated.updatedAt),
  };
}

export async function banUserAsAdmin(
  actor: ModerationActor,
  userId: string,
  input: BanUserInput,
): Promise<BanMutationResult> {
  assertAdmin(actor);

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      status: true,
    },
  });

  if (!target) {
    throw new ApiError(404, "NOT_FOUND", "User not found");
  }

  if (target.role === "admin") {
    throw new ApiError(400, "INVALID_INPUT", "Admin users cannot be banned here");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: target.id },
      data: { status: "banned" },
      select: { id: true },
    });

    const activeBan = await tx.ban.findFirst({
      where: {
        userId: target.id,
        liftedAt: null,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (!activeBan) {
      await tx.ban.create({
        data: {
          userId: target.id,
          bannedByAdminId: actor.id,
          ...(input.reason ? { reason: input.reason } : {}),
        },
        select: { id: true },
      });
    }
  });

  return {
    userId: target.id,
    status: "banned",
  };
}

export async function unbanUserAsAdmin(
  actor: ModerationActor,
  userId: string,
): Promise<BanMutationResult> {
  assertAdmin(actor);

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
    },
  });

  if (!target) {
    throw new ApiError(404, "NOT_FOUND", "User not found");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: target.id },
      data: { status: "active" },
      select: { id: true },
    });

    await tx.ban.updateMany({
      where: {
        userId: target.id,
        liftedAt: null,
      },
      data: {
        liftedAt: new Date(),
      },
    });
  });

  return {
    userId: target.id,
    status: "active",
  };
}
