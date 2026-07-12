import { describe, expect, it } from "vitest";
import { config } from "../config";
import {
  EmptyUploadError,
  UPLOADABLE_STORAGE_CATEGORIES,
  UploadCategoryNotAllowedError,
  UploadFileTypeNotAllowedError,
  UploadTooLargeError,
  getUploadPolicy,
  validateUploadCandidate,
} from "./index";

describe("upload policy", () => {
  it("exports immutable uploadable categories", () => {
    expect(
      Object.isFrozen(UPLOADABLE_STORAGE_CATEGORIES)
    ).toBe(true);

    expect(UPLOADABLE_STORAGE_CATEGORIES).toEqual([
      "reports",
      "test-tasks",
      "test-task-submissions",
    ]);
  });

  it("uses the configured maximum file size", () => {
    const policy = getUploadPolicy("reports");

    expect(policy.maximumSize).toBe(
      config.storage.maxFileSizeBytes
    );

    expect(Object.isFrozen(policy)).toBe(true);
    expect(
      Object.isFrozen(policy.allowedContentTypes)
    ).toBe(true);
    expect(
      Object.isFrozen(policy.allowedExtensions)
    ).toBe(true);
  });

  it.each([
    [
      "report.pdf",
      "application/pdf",
    ],
    [
      "report.doc",
      "application/msword",
    ],
    [
      "report.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  ])(
    "allows report file %s with MIME %s",
    (originalName, contentType) => {
      expect(() =>
        validateUploadCandidate({
          category: "reports",
          originalName,
          contentType,
          size: 1024,
        })
      ).not.toThrow();
    }
  );

  it("normalizes extension case and MIME parameters", () => {
    expect(() =>
      validateUploadCandidate({
        category: "reports",
        originalName: "REPORT.PDF",
        contentType:
          "Application/Pdf; charset=binary",
        size: 1024,
      })
    ).not.toThrow();
  });

  it.each([
    "test-tasks",
    "test-task-submissions",
  ] as const)(
    "allows ZIP for category %s",
    (category) => {
      expect(() =>
        validateUploadCandidate({
          category,
          originalName: "solution.zip",
          contentType: "application/zip",
          size: 1024,
        })
      ).not.toThrow();

      expect(() =>
        validateUploadCandidate({
          category,
          originalName: "solution.zip",
          contentType:
            "application/x-zip-compressed",
          size: 1024,
        })
      ).not.toThrow();
    }
  );

  it("rejects ZIP reports", () => {
    expect(() =>
      validateUploadCandidate({
        category: "reports",
        originalName: "report.zip",
        contentType: "application/zip",
        size: 1024,
      })
    ).toThrow(UploadFileTypeNotAllowedError);
  });

  it("rejects an empty file", () => {
    expect(() =>
      validateUploadCandidate({
        category: "reports",
        originalName: "report.pdf",
        contentType: "application/pdf",
        size: 0,
      })
    ).toThrow(EmptyUploadError);
  });

  it("rejects a file above the configured limit", () => {
    const maximumSize =
      config.storage.maxFileSizeBytes;

    expect(() =>
      validateUploadCandidate({
        category: "reports",
        originalName: "report.pdf",
        contentType: "application/pdf",
        size: maximumSize + 1,
      })
    ).toThrow(UploadTooLargeError);

    try {
      validateUploadCandidate({
        category: "reports",
        originalName: "report.pdf",
        contentType: "application/pdf",
        size: maximumSize + 1,
      });
    } catch (error) {
      expect(error).toMatchObject({
        statusCode: 413,
        code: "UPLOAD_FILE_TOO_LARGE",
        details: {
          actualSize: maximumSize + 1,
          maximumSize,
        },
      });
    }
  });

  it("allows a file exactly at the configured limit", () => {
    expect(() =>
      validateUploadCandidate({
        category: "reports",
        originalName: "report.pdf",
        contentType: "application/pdf",
        size: config.storage.maxFileSizeBytes,
      })
    ).not.toThrow();
  });

  it.each([
    {
      originalName: "report.exe",
      contentType: "application/pdf",
    },
    {
      originalName: "report.pdf",
      contentType: "application/octet-stream",
    },
    {
      originalName: "report",
      contentType: "application/pdf",
    },
    {
      originalName: "report.pdf",
      contentType: "application/zip",
    },
  ])(
    "rejects mismatched type: $originalName / $contentType",
    ({ originalName, contentType }) => {
      expect(() =>
        validateUploadCandidate({
          category: "reports",
          originalName,
          contentType,
          size: 1024,
        })
      ).toThrow(UploadFileTypeNotAllowedError);
    }
  );

  it("rejects direct user upload of generated documents", () => {
    expect(() =>
      validateUploadCandidate({
        category: "generated-documents",
        originalName: "document.docx",
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size: 1024,
      })
    ).toThrow(UploadCategoryNotAllowedError);
  });

  it("provides stable validation error codes", () => {
    const empty = new EmptyUploadError();
    const tooLarge = new UploadTooLargeError(
      11,
      10
    );
    const invalidType =
      new UploadFileTypeNotAllowedError(
        "application/x-msdownload",
        ".exe"
      );
    const invalidCategory =
      new UploadCategoryNotAllowedError();

    expect(empty.code).toBe("UPLOAD_FILE_EMPTY");
    expect(tooLarge.code).toBe(
      "UPLOAD_FILE_TOO_LARGE"
    );
    expect(invalidType.code).toBe(
      "UPLOAD_FILE_TYPE_NOT_ALLOWED"
    );
    expect(invalidCategory.code).toBe(
      "UPLOAD_CATEGORY_NOT_ALLOWED"
    );
  });
});