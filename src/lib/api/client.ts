"use client";

import { getSupabaseBrowser } from "../supabase/browser";

type ApiErrorEnvelope = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
    request_id?: string;
  };
};

export class ClientApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(args: {
    status: number;
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  }) {
    super(args.message);
    this.name = "ClientApiError";
    this.status = args.status;
    this.code = args.code;
    this.details = args.details;
    this.requestId = args.requestId;
  }
}

function normalizePath(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return path.startsWith("/") ? path : `/${path}`;
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function toError(response: Response, body: unknown): ClientApiError {
  const envelope = body as ApiErrorEnvelope | null;
  const err = envelope?.error;
  if (err?.code && err?.message) {
    return new ClientApiError({
      status: response.status,
      code: err.code,
      message: err.message,
      details: err.details,
      requestId: err.request_id,
    });
  }

  return new ClientApiError({
    status: response.status,
    code: "HTTP_ERROR",
    message: response.statusText || "Request failed",
  });
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(normalizePath(path), {
    ...init,
    cache: "no-store",
    headers: init.headers,
  });
  const body = await parseBody(response);
  if (!response.ok) throw toError(response, body);
  return body as T;
}

async function getAccessTokenOrThrow(): Promise<string> {
  const supabase = getSupabaseBrowser();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new ClientApiError({
      status: 401,
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }
  return session.access_token;
}

export async function authApiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessTokenOrThrow();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(normalizePath(path), {
    ...init,
    headers,
    cache: "no-store",
  });
  const body = await parseBody(response);
  if (!response.ok) throw toError(response, body);
  return body as T;
}

export async function authApiVoid(path: string, init: RequestInit = {}): Promise<void> {
  await authApiJson<unknown>(path, init);
}

