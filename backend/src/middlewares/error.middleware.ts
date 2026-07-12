import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

function defaultErrorCode(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 413:
      return "PAYLOAD_TOO_LARGE";
    default:
      return statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_FAILED";
  }
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: unknown;

  constructor(
    message: string,
    statusCode: number,
    code = defaultErrorCode(statusCode),
    details: unknown = null
  ) {
    super(message);

    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function isMalformedJsonError(
  err: Error
): err is SyntaxError & { status: number; body: string } {
  return (
    err instanceof SyntaxError &&
    "status" in err &&
    err.status === 400 &&
    "body" in err
  );
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (isMalformedJsonError(err)) {
    return res.status(400).json({
      code: "INVALID_JSON",
      message: "Request body contains invalid JSON",
      details: null,
      requestId: req.requestId ?? null,
    });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
      details: err.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
      requestId: req.requestId ?? null,
    });
  }

  const isOperationalError = err instanceof AppError;
  const statusCode = isOperationalError ? err.statusCode : 500;
  const code = isOperationalError
    ? err.code
    : "INTERNAL_SERVER_ERROR";
  const message = isOperationalError
    ? err.message
    : "Internal server error";
  const details = isOperationalError ? err.details : null;

  console.error({
    level: "error",
    requestId: req.requestId ?? null,
    code,
    statusCode,
    message: err.message,
    stack: statusCode >= 500 ? err.stack : undefined,
  });

  return res.status(statusCode).json({
    code,
    message,
    details,
    requestId: req.requestId ?? null,
  });
}