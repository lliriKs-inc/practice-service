import {
  ApplicationStatus,
  DocumentType,
  UserRole,
} from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../shared/prisma";
import type { StorageService } from "../../shared/storage";
import { GeneratedDocumentService } from "./generated-document.service";
import type { DocumentGeneratorService } from "./documentGenerator.service";

const storage: StorageService = {
  save: vi.fn(),
  open: vi.fn(),
  exists: vi.fn(),
  remove: vi.fn(),
  replace: vi.fn(),
  parseKey: vi.fn(),
};

const generator = {
  generate: vi.fn(() => Buffer.from("docx")),
} as unknown as DocumentGeneratorService;

describe("GeneratedDocumentService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("stores a generated DOCX and updates generated metadata", async () => {
    vi.spyOn(prisma.application, "findFirst").mockResolvedValue({
      id: "application-1",
      status: ApplicationStatus.APPROVED,
      report: null,
      documents: [
        {
          id: "document-1",
          type: DocumentType.NOTICE,
          generated_file_url: "generated-documents/old.docx",
          generated_at: new Date("2026-07-01T00:00:00.000Z"),
          fieldValues: [
            { field_key: "student_fio", value: "Student" },
            { field_key: "group", value: "G-1" },
            { field_key: "practice_topic", value: "API" },
          ],
        },
      ],
    } as never);
    vi.mocked(storage.replace).mockResolvedValue({
      key: "generated-documents/new.docx",
      category: "generated-documents",
      originalName: "notice.docx",
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 4,
      checksum: "checksum",
      storedAt: new Date(),
    });
    const upsert = vi
      .spyOn(prisma.document, "upsert")
      .mockResolvedValue({ id: "document-1" } as never);

    const result = await new GeneratedDocumentService(
      storage,
      generator
    ).generateMine("student-1", "application-1", "notice");

    expect(storage.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        previousKey: "generated-documents/old.docx",
        file: expect.objectContaining({
          category: "generated-documents",
          originalName: "notice.docx",
        }),
      })
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          generated_file_url: "generated-documents/new.docx",
          generated_at: expect.any(Date),
        },
      })
    );
    expect(result.buffer).toEqual(Buffer.from("docx"));
  });

  it("does not create a file when required fields are missing", async () => {
    vi.spyOn(prisma.application, "findFirst").mockResolvedValue({
      id: "application-1",
      report: null,
      documents: [],
    } as never);

    await expect(
      new GeneratedDocumentService(storage, generator).generateMine(
        "student-1",
        "application-1",
        "notice"
      )
    ).rejects.toMatchObject({
      code: "DOCUMENT_NOT_READY",
    });
    expect(storage.replace).not.toHaveBeenCalled();
  });
});
