import type {
  LogContext,
} from "./logger.types";

const MAX_DEPTH = 6;

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "cookie",
  "secret",
  "jwtsecret",
  "smtppassword",
  "content",
  "buffer",
]);

function normalizeKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function sanitizeValue(
  value: unknown,
  key: string | null,
  seen: WeakSet<object>,
  depth: number
): unknown {
  if (
    key &&
    SENSITIVE_KEYS.has(normalizeKey(key))
  ) {
    return "[REDACTED]";
  }

  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "symbol") {
    return value.toString();
  }

  if (typeof value === "function") {
    return "[Function]";
  }

  if (Buffer.isBuffer(value)) {
    return `[Buffer ${value.length} bytes]`;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
    };
  }

  if (depth >= MAX_DEPTH) {
    return "[MaxDepth]";
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }

    seen.add(value);

    if (Array.isArray(value)) {
      return value.map((item) =>
        sanitizeValue(
          item,
          null,
          seen,
          depth + 1
        )
      );
    }

    const result: Record<string, unknown> = {};

    for (const [childKey, childValue] of Object.entries(
      value
    )) {
      result[childKey] = sanitizeValue(
        childValue,
        childKey,
        seen,
        depth + 1
      );
    }

    return result;
  }

  return String(value);
}

export function sanitizeLogContext(
  context: LogContext = {}
): LogContext {
  return sanitizeValue(
    context,
    null,
    new WeakSet<object>(),
    0
  ) as LogContext;
}
