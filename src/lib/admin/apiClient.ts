"use client";

import { getSupabaseBrowser } from "./supabase-browser";
import type { ApiErrorEnvelope } from "./types";

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

export class AdminApiError extends Error {
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
    this.name = "AdminApiError";
    this.status = args.status;
    this.code = args.code;
    this.details = args.details;
    this.requestId = args.requestId;
  }
}

function redirectForAuthStatus(status: number): void {
  if (typeof window === "undefined") return;

  if (status === 401) {
    window.location.assign("/admin/login");
    return;
  }

  if (status === 403) {
    window.location.assign("/admin/forbidden");
  }
}

async function readJsonSafely(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as JsonValue;
  } catch {
    return null;
  }
}

function toApiError(response: Response, body: unknown): AdminApiError {
  const envelope = body as Partial<ApiErrorEnvelope> | null;
  const err = envelope?.error;
  if (err && typeof err.code === "string" && typeof err.message === "string") {
    return new AdminApiError({
      status: response.status,
      code: err.code,
      message: err.message,
      details: err.details,
      requestId: err.request_id,
    });
  }

  return new AdminApiError({
    status: response.status,
    code: "HTTP_ERROR",
    message: response.statusText || "Request failed",
  });
}

function normalizePath(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/")) return path;
  return `/${path}`;
}

async function getAccessToken(): Promise<string> {
  const supabase = getSupabaseBrowser();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    redirectForAuthStatus(401);
    throw new AdminApiError({
      status: 401,
      code: "UNAUTHORIZED",
      message: "No active session",
    });
  }

  return session.access_token;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
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

  if (response.status === 401 || response.status === 403) {
    redirectForAuthStatus(response.status);
  }

  return response;
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, init);
  const body = await readJsonSafely(response);

  if (!response.ok) {
    throw toApiError(response, body);
  }

  return body as T;
}

export async function apiVoid(path: string, init: RequestInit = {}): Promise<void> {
  const response = await apiFetch(path, init);
  const body = response.status === 204 ? null : await readJsonSafely(response);

  if (!response.ok) {
    throw toApiError(response, body);
  }
}

export async function publicJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(normalizePath(path), {
    ...init,
    cache: "no-store",
    headers: init.headers,
  });
  const body = await readJsonSafely(response);

  if (!response.ok) {
    throw toApiError(response, body);
  }

  return body as T;
}
