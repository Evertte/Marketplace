import { createRemoteJWKSet, jwtVerify } from "jose";
import type { JWTPayload } from "jose";

import { ApiError } from "../http/errors";

type VerifiedSupabaseJwt = {
  sub: string;
  email?: string;
  payload: JWTPayload;
};

type JwksCacheEntry = {
  jwksUrl: string;
  expiresAtMs: number;
  getKey: ReturnType<typeof createRemoteJWKSet>;
};

let jwksCache: JwksCacheEntry | null = null;

const DEFAULT_JWKS_CACHE_TTL_SECONDS = 600;

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function getSupabaseBaseUrl(): string {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  if (supabaseUrl) {
    return normalizeBaseUrl(supabaseUrl);
  }

  const projectRef = process.env.SUPABASE_PROJECT_REF?.trim();
  if (projectRef) {
    return `https://${projectRef}.supabase.co`;
  }

  throw new ApiError(
    500,
    "SERVER_MISCONFIG",
    "Missing SUPABASE_URL or SUPABASE_PROJECT_REF",
  );
}

function getJwksTtlMs(): number {
  const raw = process.env.JWKS_CACHE_TTL_SECONDS?.trim();
  if (!raw) {
    return DEFAULT_JWKS_CACHE_TTL_SECONDS * 1000;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_JWKS_CACHE_TTL_SECONDS * 1000;
  }

  return parsed * 1000;
}

function getJwksKeyResolver(): ReturnType<typeof createRemoteJWKSet> {
  const baseUrl = getSupabaseBaseUrl();
  const jwksUrl = `${baseUrl}/auth/v1/.well-known/jwks.json`;
  const now = Date.now();

  if (jwksCache && jwksCache.jwksUrl === jwksUrl && jwksCache.expiresAtMs > now) {
    return jwksCache.getKey;
  }

  const getKey = createRemoteJWKSet(new URL(jwksUrl));
  jwksCache = {
    jwksUrl,
    getKey,
    expiresAtMs: now + getJwksTtlMs(),
  };

  return getKey;
}

function validateIssuerIfConfigured(payload: JWTPayload): void {
  const configuredSupabaseUrl = process.env.SUPABASE_URL?.trim();
  if (!configuredSupabaseUrl || payload.iss === undefined) {
    return;
  }

  if (typeof payload.iss !== "string") {
    throw new ApiError(401, "AUTH_INVALID_TOKEN", "Invalid token issuer");
  }

  const expectedPrefix = normalizeBaseUrl(configuredSupabaseUrl);
  const actualIssuer = normalizeBaseUrl(payload.iss);

  if (!actualIssuer.startsWith(expectedPrefix)) {
    throw new ApiError(401, "AUTH_INVALID_TOKEN", "Token issuer mismatch");
  }
}

export async function verifySupabaseJwt(token: string): Promise<VerifiedSupabaseJwt> {
  if (!token.trim()) {
    throw new ApiError(401, "AUTH_INVALID_TOKEN", "Invalid bearer token");
  }

  try {
    const getKey = getJwksKeyResolver();
    const { payload } = await jwtVerify(token, getKey);

    validateIssuerIfConfigured(payload);

    if (typeof payload.sub !== "string" || !payload.sub) {
      throw new ApiError(401, "AUTH_INVALID_TOKEN", "Missing token subject");
    }

    const email = typeof payload.email === "string" ? payload.email : undefined;

    return {
      sub: payload.sub,
      email,
      payload,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(401, "INVALID_TOKEN", "Invalid or expired token");
  }
}

export type { VerifiedSupabaseJwt };
