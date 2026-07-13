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

    await service.replaceMine(
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

    await service.review(
      "admin-1",
      "cohort-1",
      "application-1",
      ReportStatus.APPROVED
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: ReportStatus.APPROVED,
          reviewed_at: expect.any(Date),
        },
      })
    );
  });
});
