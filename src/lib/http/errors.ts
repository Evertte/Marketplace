import { NextRequest, NextResponse } from "next/server";

type JsonErrorOptions = {
  status: number;
  code: string;
  message: string;
  details?: unknown;
};

type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
    request_id: string;
  };
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function resolveRequestId(req: NextRequest): string {
  return req.headers.get("x-request-id")?.trim() || crypto.randomUUID();
}

export function jsonError(
  req: NextRequest,
  { status, code, message, details }: JsonErrorOptions,
): NextResponse<ApiErrorBody> {
  const requestId = resolveRequestId(req);

  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
        request_id: requestId,
      },
    },
    { status },
  );
}

export function unauthorized(
  req: NextRequest,
  code: string,
  message: string,
  details?: unknown,
): NextResponse<ApiErrorBody> {
  return jsonError(req, { status: 401, code, message, details });
}

export function forbidden(
  req: NextRequest,
  code: string,
  message: string,
  details?: unknown,
): NextResponse<ApiErrorBody> {
  return jsonError(req, { status: 403, code, message, details });
}

export function badRequest(
  req: NextRequest,
  code: string,
  message: string,
  details?: unknown,
): NextResponse<ApiErrorBody> {
  return jsonError(req, { status: 400, code, message, details });
}

export function errorResponseFromUnknown(
  req: NextRequest,
  error: unknown,
): NextResponse<ApiErrorBody> {
  if (error instanceof ApiError) {
    return jsonError(req, {
      status: error.status,
      code: error.code,
      message: error.message,
      details: error.details,
    });
  }

  return jsonError(req, {
    status: 500,
    code: "INTERNAL_ERROR",
    message: "Internal server error",
  });
}
