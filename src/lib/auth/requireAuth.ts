import type { User } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";

import { prisma } from "../db/prisma";
import { ApiError } from "../http/errors";
import { verifySupabaseJwt } from "./supabaseJwt";

type RequireAuthResult = {
  user: User;
};

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function readBearerToken(req: NextRequest): string {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    throw new ApiError(401, "UNAUTHORIZED", "Missing Authorization header");
  }

  const [scheme, token, ...rest] = authHeader.trim().split(/\s+/);
  if (rest.length > 0 || scheme?.toLowerCase() !== "bearer" || !token) {
    throw new ApiError(401, "UNAUTHORIZED", "Invalid Authorization header");
  }

  return token;
}

export async function requireAuth(req: NextRequest): Promise<RequireAuthResult> {
  const token = readBearerToken(req);
  const { sub, email } = await verifySupabaseJwt(token);

  if (!isUuidLike(sub)) {
    throw new ApiError(401, "INVALID_TOKEN_CLAIMS", "Invalid token subject");
  }

  let user: User;

  try {
    if (!email) {
      const existingUser = await prisma.user.findUnique({
        where: { authUserId: sub },
      });

      if (!existingUser) {
        throw new ApiError(
          401,
          "INVALID_TOKEN_CLAIMS",
          "Missing required email claim for first-time login",
        );
      }

      user = existingUser;
    } else {
      user = await prisma.user.upsert({
        where: { authUserId: sub },
        create: {
          authUserId: sub,
          email,
          role: "user",
          status: "active",
        },
        update: {
          ...(email ? { email } : {}),
        },
      });
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ApiError(403, "FORBIDDEN", "Unable to sync authenticated user");
    }

    throw error;
  }

  if (user.status === "banned") {
    throw new ApiError(403, "USER_BANNED", "User account is banned");
  }

  return { user };
}

export type { RequireAuthResult };
