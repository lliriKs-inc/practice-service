import { Readable } from "node:stream";
import {
  ApplicationStatus,
  DocumentType,
} from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../shared/prisma";
import type { StorageService } from "../../shared/storage";
import { DocumentFileService } from "./document-file.service";

const storage: StorageService = {
  save: vi.fn(),
  open: vi.fn(),
  exists: vi.fn(),
  remove: vi.fn(),
  replace: vi.fn(),
  parseKey: vi.fn(),
};

describe("DocumentFileService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("opens an admin report only through a cohort-scoped application", async () => {
    const findFirst = vi
      .spyOn(prisma.application, "findFirst")
      .mockResolvedValue({
        report: { file_url: "reports/report.pdf" },
      } as never);
    vi.mocked(storage.open).mockResolvedValue({
      key: "reports/report.pdf",
      stream: Readable.from("report"),
      size: 6,
    });

    const result = await new DocumentFileService(
      storage
    ).openAdminReport("cohort-1", "application-1");

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: "application-1",
        status: ApplicationStatus.APPROVED,
        track: { cohort_id: "cohort-1" },
      },
      select: { report: { select: { file_url: true } } },
    });
    expect(storage.open).toHaveBeenCalledWith("reports/report.pdf");
    expect(result.downloadName).toBe("report");
  });

  it("hides reports from another cohort behind a 404", async () => {
    vi.spyOn(prisma.application, "findFirst").mockResolvedValue(null);

    await expect(
      new DocumentFileService(storage).openAdminReport(
        "cohort-1",
        "application-from-cohort-2"
      )
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "DOCUMENT_FILE_NOT_FOUND",
    });
    expect(storage.open).not.toHaveBeenCalled();
  });

  it("opens a generated document only through its application and type", async () => {
    const findFirst = vi
      .spyOn(prisma.document, "findFirst")
      .mockResolvedValue({
        generated_file_url: "generated-documents/notice.docx",
      } as never);
    vi.mocked(storage.open).mockResolvedValue({
      key: "generated-documents/notice.docx",
      stream: Readable.from("docx"),
      size: 4,
    });

    await new DocumentFileService(storage).openAdminDocument(
      "cohort-1",
      "application-1",
      DocumentType.NOTICE
    );

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        application_id: "application-1",
        type: DocumentType.NOTICE,
        application: {
          status: ApplicationStatus.APPROVED,
          track: { cohort_id: "cohort-1" },
        },
      },
      select: { generated_file_url: true },
    });
  });
});
