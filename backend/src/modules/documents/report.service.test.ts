import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  ApplicationStatus,
  ReportStatus,
} from "@prisma/client";
import { prisma } from "../../shared/prisma";
import type { StorageService } from "../../shared/storage";
import { ReportService } from "./report.service";

const storage: StorageService = {
  save: vi.fn(),
  open: vi.fn(),
  exists: vi.fn(),
  remove: vi.fn(),
  replace: vi.fn(),
  parseKey: vi.fn(),
};

const service = new ReportService(storage);

describe("ReportService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects another student's application", async () => {
    vi.spyOn(
      prisma.application,
      "findFirst"
    ).mockResolvedValue(null);

    await expect(
      service.getMine(
        "another-student",
        "application-1"
      )
    ).rejects.toMatchObject({
      code: "APPLICATION_NOT_FOUND",
    });
  });

  it("returns safe report metadata without exposing the storage key", async () => {
    vi.spyOn(prisma.application, "findFirst").mockResolvedValue({
      id: "application-1",
      report: {
        id: "report-1",
        file_url: "reports/private.pdf",
        status: ReportStatus.PENDING,
        uploaded_at: new Date("2026-07-14T00:00:00.000Z"),
        reviewed_at: null,
      },
    } as never);

    const result = await service.getMine(
      "student-1",
      "application-1"
    );

    expect(result).toMatchObject({
      id: "report-1",
      hasFile: true,
      downloadPath: "/me/applications/application-1/report/file",
    });
    expect(JSON.stringify(result)).not.toContain("private.pdf");
    expect(JSON.stringify(result)).not.toContain("file_url");
  });

  it("replaces report and resets status to pending", async () => {
    vi.spyOn(
      prisma.application,
      "findFirst"
    ).mockResolvedValue({
      id: "application-1",
      report: {
        file_url: "reports/old-file",
        status: ReportStatus.APPROVED,
      },
    } as any);

    vi.mocked(storage.replace).mockResolvedValue({
      key: "reports/new-file",
      category: "reports",
      originalName: "report.docx",
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 10,
      checksum: "checksum",
      storedAt: new Date(),
    });

    const upsert = vi
      .spyOn(prisma.report, "upsert")
      .mockResolvedValue({
        application_id: "application-1",
        file_url: "reports/new-file",
        status: ReportStatus.PENDING,
        uploaded_at: new Date(),
        reviewed_at: null,
        id: "report-1",
      } as any);

    const result = await service.replaceMine(
      "student-1",
      "application-1",
      {
        category: "reports",
        content: Buffer.from("report"),
        originalName: "report.docx",
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }
    );

    expect(storage.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        previousKey: "reports/old-file",
      })
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          file_url: "reports/new-file",
          status: ReportStatus.PENDING,
          reviewed_at: null,
        }),
      })
    );
    expect(result).toMatchObject({
      id: "report-1",
      downloadPath: "/me/applications/application-1/report/file",
    });
    expect(JSON.stringify(result)).not.toContain("new-file");
  });

  it("reviews a report only inside the selected cohort", async () => {
    vi.spyOn(
      prisma.application,
      "findFirst"
    ).mockResolvedValue({
      id: "application-1",
      report: {
        file_url: "reports/file",
      },
    } as any);

    const update = vi
      .spyOn(prisma.report, "update")
      .mockResolvedValue({
        id: "report-1",
        application_id: "application-1",
        file_url: "reports/file",
        status: ReportStatus.APPROVED,
        uploaded_at: new Date(),
        reviewed_at: new Date(),
      } as any);

    const record = vi.fn();
    const auditedService = new ReportService(storage, { record });

    await auditedService.review(
      "admin-1",
      "cohort-1",
      "application-1",
      ReportStatus.APPROVED,
      undefined,
      "request-1"
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: ReportStatus.APPROVED,
          rejection_reason: null,
          reviewed_at: expect.any(Date),
        },
      })
    );
    expect(record).toHaveBeenCalledWith(expect.objectContaining({
      action: "REPORT_STATUS_CHANGED",
      actorId: "admin-1",
      requestId: "request-1",
      resourceId: "report-1",
    }));
  });
});
