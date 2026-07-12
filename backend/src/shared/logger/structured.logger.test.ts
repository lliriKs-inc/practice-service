import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  ConsoleLogSink,
  StructuredLogger,
  sanitizeLogContext,
} from "./index";
import type {
  LogEntry,
  LogSink,
} from "./index";

class MemoryLogSink implements LogSink {
  readonly entries: LogEntry[] = [];

  write(entry: LogEntry): void {
    this.entries.push(entry);
  }
}

describe("StructuredLogger", () => {
  it("writes a structured entry with a deterministic timestamp", () => {
    const sink = new MemoryLogSink();

    const logger = new StructuredLogger({
      level: "debug",
      sink,
      now: () =>
        new Date("2026-07-12T09:00:00.000Z"),
    });

    logger.info("File stored", {
      requestId: "request-1",
      actorId: "student-1",
    });

    expect(sink.entries).toEqual([
      {
        timestamp: "2026-07-12T09:00:00.000Z",
        level: "info",
        message: "File stored",
        context: {
          requestId: "request-1",
          actorId: "student-1",
        },
      },
    ]);
  });

  it("filters messages below the configured level", () => {
    const sink = new MemoryLogSink();

    const logger = new StructuredLogger({
      level: "warn",
      sink,
    });

    logger.debug("debug");
    logger.info("info");
    logger.warn("warn");
    logger.error("error");

    expect(
      sink.entries.map((entry) => entry.level)
    ).toEqual([
      "warn",
      "error",
    ]);
  });

  it("redacts sensitive keys recursively", () => {
    const context = sanitizeLogContext({
      password: "plain-password",
      password_hash: "bcrypt-hash",
      token: "jwt-token",
      accessToken: "access-token",
      refresh_token: "refresh-token",
      authorization: "Bearer secret",
      cookie: "session=secret",
      jwtSecret: "jwt-secret",
      smtp_password: "smtp-secret",
      nested: {
        secret: "nested-secret",
        safe: "visible",
      },
    });

    expect(context).toEqual({
      password: "[REDACTED]",
      password_hash: "[REDACTED]",
      token: "[REDACTED]",
      accessToken: "[REDACTED]",
      refresh_token: "[REDACTED]",
      authorization: "[REDACTED]",
      cookie: "[REDACTED]",
      jwtSecret: "[REDACTED]",
      smtp_password: "[REDACTED]",
      nested: {
        secret: "[REDACTED]",
        safe: "visible",
      },
    });
  });

  it("never serializes binary file content", () => {
    const context = sanitizeLogContext({
      payload: Buffer.from("private-file-content"),
      content: Buffer.from("hidden"),
      buffer: Buffer.from("hidden"),
    });

    expect(context).toEqual({
      payload: "[Buffer 20 bytes]",
      content: "[REDACTED]",
      buffer: "[REDACTED]",
    });

    expect(JSON.stringify(context)).not.toContain(
      "private-file-content"
    );
  });

  it("serializes Error without exposing its stack", () => {
    const error = new Error("Storage unavailable");
    error.stack = "SECRET STACK TRACE";

    const context = sanitizeLogContext({
      error,
    });

    expect(context).toEqual({
      error: {
        name: "Error",
        message: "Storage unavailable",
      },
    });

    expect(JSON.stringify(context)).not.toContain(
      "SECRET STACK TRACE"
    );
  });

  it("handles circular objects", () => {
    const circular: Record<string, unknown> = {
      id: "object-1",
    };

    circular.self = circular;

    const context = sanitizeLogContext({
      circular,
    });

    expect(context).toEqual({
      circular: {
        id: "object-1",
        self: "[Circular]",
      },
    });
  });

  it("serializes dates and bigint values", () => {
    const context = sanitizeLogContext({
      createdAt: new Date(
        "2026-07-12T09:00:00.000Z"
      ),
      size: 123n,
    });

    expect(context).toEqual({
      createdAt: "2026-07-12T09:00:00.000Z",
      size: "123",
    });
  });

  it("stops serializing excessively deep objects", () => {
    const context = sanitizeLogContext({
      level1: {
        level2: {
          level3: {
            level4: {
              level5: {
                level6: {
                  level7: "hidden",
                },
              },
            },
          },
        },
      },
    });

    expect(JSON.stringify(context)).toContain(
      "[MaxDepth]"
    );

    expect(JSON.stringify(context)).not.toContain(
      "hidden"
    );
  });
});

describe("ConsoleLogSink", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(
      () => undefined
    );
    vi.spyOn(console, "warn").mockImplementation(
      () => undefined
    );
    vi.spyOn(console, "error").mockImplementation(
      () => undefined
    );
  });

  it("writes each level to the appropriate console method", () => {
    const sink = new ConsoleLogSink();

    const baseEntry = {
      timestamp: "2026-07-12T09:00:00.000Z",
      message: "message",
      context: {},
    };

    sink.write({
      ...baseEntry,
      level: "info",
    });

    sink.write({
      ...baseEntry,
      level: "warn",
    });

    sink.write({
      ...baseEntry,
      level: "error",
    });

    expect(console.log).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);

    const serializedInfo = vi.mocked(
      console.log
    ).mock.calls[0][0];

    expect(
      JSON.parse(String(serializedInfo))
    ).toEqual({
      ...baseEntry,
      level: "info",
    });
  });
});
