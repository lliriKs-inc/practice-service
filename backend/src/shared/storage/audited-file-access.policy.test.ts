import { UserRole } from "@prisma/client";
import {
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type {
  AuditLogger,
} from "../logger";
import {
  AuditedFileAccessPolicy,
} from "./audited-file-access.policy";
import type {
  FileAccessPolicy,
  FileAccessRequest,
} from "./file-access.policy";

const accessRequest: FileAccessRequest = {
  actor: {
    id: "student-1",
    role: UserRole.STUDENT,
  },
  key: "reports/file.pdf",
  requestId: "request-1",
};

function createAuditMock(): AuditLogger {
  return {
    record: vi.fn(),
  };
}

describe("AuditedFileAccessPolicy", () => {
  it("records granted downloads", async () => {
    const authorization = {
      downloadName: "report.pdf",
      contentType: "application/pdf",
      disposition: "attachment" as const,
    };

    const policy: FileAccessPolicy = {
      authorize: vi.fn(async () =>
        authorization
      ),
    };

    const audit = createAuditMock();

    const auditedPolicy =
      new AuditedFileAccessPolicy(
        policy,
        audit
      );

    await expect(
      auditedPolicy.authorize(accessRequest)
    ).resolves.toEqual(authorization);

    expect(audit.record).toHaveBeenCalledWith({
      action: "FILE_DOWNLOAD_GRANTED",
      outcome: "success",
      actorId: "student-1",
      requestId: "request-1",
      resourceType: "stored-file",
      resourceId: "reports/file.pdf",
      metadata: {
        disposition: "attachment",
        contentType: "application/pdf",
      },
    });
  });

  it("records denied downloads without exposing a reason to the caller", async () => {
    const policy: FileAccessPolicy = {
      authorize: vi.fn(async () => null),
    };

    const audit = createAuditMock();

    const auditedPolicy =
      new AuditedFileAccessPolicy(
        policy,
        audit
      );

    await expect(
      auditedPolicy.authorize(accessRequest)
    ).resolves.toBeNull();

    expect(audit.record).toHaveBeenCalledWith({
      action: "FILE_DOWNLOAD_DENIED",
      outcome: "denied",
      actorId: "student-1",
      requestId: "request-1",
      resourceType: "stored-file",
      resourceId: "reports/file.pdf",
      metadata: {
        reason: "policy_denied",
      },
    });
  });

  it("records policy failures and rethrows the original error", async () => {
    const policyError = new Error(
      "Database unavailable"
    );

    const policy: FileAccessPolicy = {
      authorize: vi.fn(async () => {
        throw policyError;
      }),
    };

    const audit = createAuditMock();

    const auditedPolicy =
      new AuditedFileAccessPolicy(
        policy,
        audit
      );

    await expect(
      auditedPolicy.authorize(accessRequest)
    ).rejects.toBe(policyError);

    expect(audit.record).toHaveBeenCalledWith({
      action: "FILE_DOWNLOAD_DENIED",
      outcome: "failure",
      actorId: "student-1",
      requestId: "request-1",
      resourceType: "stored-file",
      resourceId: "reports/file.pdf",
      metadata: {
        reason: "policy_failure",
        error: policyError,
      },
    });
  });

  it("uses attachment as the default audited disposition", async () => {
    const policy: FileAccessPolicy = {
      authorize: vi.fn(async () => ({
        downloadName: "report.pdf",
        contentType: "application/pdf",
      })),
    };

    const audit = createAuditMock();

    const auditedPolicy =
      new AuditedFileAccessPolicy(
        policy,
        audit
      );

    await auditedPolicy.authorize(accessRequest);

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          disposition: "attachment",
          contentType: "application/pdf",
        },
      })
    );
  });
});
