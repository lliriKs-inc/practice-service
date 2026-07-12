import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import {
  InvalidStorageKeyError,
  STORAGE_CATEGORIES,
  StorageError,
  StorageFileNotFoundError,
} from "./index";
import type {
  OpenedFile,
  ReplaceFileInput,
  SaveFileInput,
  StorageCategory,
  StorageKeyParts,
  StorageService,
  StoredFile,
} from "./index";

class ContractTestStorage implements StorageService {
  async save(input: SaveFileInput): Promise<StoredFile> {
    return {
      key: `${input.category}/test-file.bin`,
      category: input.category,
      originalName: input.originalName,
      contentType: input.contentType,
      size: input.content.length,
      checksum: "test-checksum",
      storedAt: new Date("2026-07-12T00:00:00.000Z"),
    };
  }

  async open(key: string): Promise<OpenedFile> {
    return {
      key,
      stream: Readable.from([Buffer.from("test")]),
      size: 4,
    };
  }

  async exists(_key: string): Promise<boolean> {
    return true;
  }

  async remove(_key: string): Promise<void> {
    return undefined;
  }

  async replace(input: ReplaceFileInput): Promise<StoredFile> {
    return this.save(input.file);
  }

  parseKey(key: string): StorageKeyParts {
    const [category = "", fileName = ""] = key.split("/");

    return {
      category: category as StorageCategory,
      fileName,
    };
  }
}

describe("StorageService contract", () => {
  it("exports an immutable set of storage categories", () => {
    expect(Object.isFrozen(STORAGE_CATEGORIES)).toBe(true);

    expect(STORAGE_CATEGORIES).toEqual([
      "reports",
      "test-tasks",
      "test-task-submissions",
      "generated-documents",
    ]);
  });

  it("can be implemented without Prisma or Multer", async () => {
    const storage: StorageService = new ContractTestStorage();

    const stored = await storage.save({
      category: "reports",
      content: Buffer.from("report"),
      originalName: "report.pdf",
      contentType: "application/pdf",
    });

    expect(stored).toMatchObject({
      key: "reports/test-file.bin",
      category: "reports",
      originalName: "report.pdf",
      contentType: "application/pdf",
      size: 6,
      checksum: "test-checksum",
    });

    await expect(storage.exists(stored.key)).resolves.toBe(true);
  });

  it("provides stable storage error codes", () => {
    const notFound = new StorageFileNotFoundError(
      "reports/missing.pdf"
    );
    const invalidKey = new InvalidStorageKeyError();
    const internalError = new StorageError(
      "Storage unavailable",
      "STORAGE_UNAVAILABLE"
    );

    expect(notFound.statusCode).toBe(404);
    expect(notFound.code).toBe("STORAGE_FILE_NOT_FOUND");
    expect(notFound.details).toEqual({
      key: "reports/missing.pdf",
    });

    expect(invalidKey.statusCode).toBe(400);
    expect(invalidKey.code).toBe("INVALID_STORAGE_KEY");
    expect(invalidKey.details).toBeNull();

    expect(internalError.statusCode).toBe(500);
    expect(internalError.code).toBe(
      "STORAGE_UNAVAILABLE"
    );
  });
});