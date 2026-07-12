import { describe, expect, it } from "vitest";
import {
  StructuredAuditLogger,
  StructuredLogger,
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

function createAuditLogger() {
  const sink = new MemoryLogSink();

  const logger = new StructuredLogger({
    level: "debug",
    sink,
    now: () =>
      new Date("2026-07-12T10:00:00.000Z"),
  });

  return {
    sink,
    audit: new StructuredAuditLogger(logger),
  };
}

describe("StructuredAuditLogger", () => {
  it("records successful events at info level", () => {
    const { sink, audit } = createAuditLogger();

    audit.record({
      action: "FILE_STORED",
      outcome: "success",
      actorId: "student-1",
      requestId: "request-1",
      resourceType: "report",
      resourceId: "report-1",
      metadata: {
        storageKey: "reports/file.pdf",
        size: 1024,
      },
    });

    expect(sink.entries).toEqual([
      {
        timestamp: "2026-07-12T10:00:00.000Z",
        level: "info",
        message: "Security audit event",
        context: {
          audit: true,
          action: "FILE_STORED",
          outcome: "success",
          actorId: "student-1",
          requestId: "request-1",
          resource: {
            type: "report",
            id: "report-1",
          },
          metadata: {
            storageKey: "reports/file.pdf",
            size: 1024,
          },
        },
      },
    ]);
  });

  it.each([
    "denied",
    "failure",
  ] as const)(
    "records %s events at warn level",
    (outcome) => {
      const { sink, audit } =
        createAuditLogger();

      audit.record({
        action: "FILE_DOWNLOAD_DENIED",
        outcome,
        actorId: "student-2",
        requestId: "request-2",
        resourceType: "file",
        resourceId: "hidden-file",
      });

      expect(sink.entries).toHaveLength(1);
      expect(sink.entries[0].level).toBe(
        "warn"
      );
      expect(
        sink.entries[0].context.outcome
      ).toBe(outcome);
    }
  );

  it("supports system events without an actor", () => {
    const { sink, audit } = createAuditLogger();

    audit.record({
      action: "FILE_REMOVED",
      outcome: "success",
      actorId: null,
      requestId: null,
      resourceType: "orphan-file",
      resourceId: "file-1",
    });

    expect(sink.entries[0].context).toMatchObject({
      actorId: null,
      requestId: null,
    });
  });

  it("redacts secrets and binary data in audit metadata", () => {
    const { sink, audit } = createAuditLogger();

    audit.record({
      action: "FILE_STORED",
      outcome: "success",
      actorId: "student-1",
      requestId: "request-3",
      resourceType: "report",
      resourceId: "report-2",
      metadata: {
        password: "plain-password",
        token: "jwt-token",
        content: Buffer.from("private-report"),
        safeValue: "visible",
      },
    });

    expect(
      sink.entries[0].context.metadata
    ).toEqual({
      password: "[REDACTED]",
      token: "[REDACTED]",
      content: "[REDACTED]",
      safeValue: "visible",
    });

    expect(
      JSON.stringify(sink.entries[0])
    ).not.toContain("private-report");
  });
});
