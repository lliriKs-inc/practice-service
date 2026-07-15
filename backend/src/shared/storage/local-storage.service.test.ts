import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  InvalidStorageKeyError,
  LocalStorageService,
  StorageError,
  StorageFileNotFoundError,
} from "./index";

const FIRST_UUID =
  "11111111-1111-4111-8111-111111111111";

const SECOND_UUID =
  "22222222-2222-4222-8222-222222222222";

async function streamToBuffer(
  stream: NodeJS.ReadableStream
): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(
      Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk)
    );
  }

  return Buffer.concat(chunks);
}

describe("LocalStorageService", () => {
  let rootDirectory: string;

  beforeEach(async () => {
    rootDirectory = await mkdtemp(
      path.join(tmpdir(), "practice-storage-")
    );
  });

  afterEach(async () => {
    await rm(rootDirectory, {
      recursive: true,
      force: true,
    });
  });

  it("stores a file under a category and returns metadata", async () => {
    const now = new Date("2026-07-12T08:00:00.000Z");

    const storage = new LocalStorageService({
      rootDirectory,
      generateId: () => FIRST_UUID,
      now: () => now,
    });

    const content = Buffer.from("practice report");

    const stored = await storage.save({
      category: "reports",
      content,
      originalName: "report.PDF",
      contentType: "application/pdf",
    });

    const expectedChecksum = createHash("sha256")
      .update(content)
      .digest("hex");

    expect(stored).toEqual({
      key: `reports/${FIRST_UUID}.pdf`,
      category: "reports",
      originalName: "report.PDF",
      contentType: "application/pdf",
      size: content.length,
      checksum: expectedChecksum,
      storedAt: now,
    });

    const physicalContent = await readFile(
      path.join(
        rootDirectory,
        "reports",
        `${FIRST_UUID}.pdf`
      )
    );

    expect(physicalContent).toEqual(content);
  });

  it("records runtime audit events for storage mutations", async () => {
    const record = vi.fn();
    const generatedIds = [FIRST_UUID, SECOND_UUID];
    const storage = new LocalStorageService({
      rootDirectory,
      generateId: () => generatedIds.shift()!,
      audit: { record },
    });

    const first = await storage.save({
      category: "reports",
      content: Buffer.from("old"),
      originalName: "old.pdf",
      contentType: "application/pdf",
    });
    const replacement = await storage.replace({
      previousKey: first.key,
      file: {
        category: "reports",
        content: Buffer.from("new"),
        originalName: "new.pdf",
        contentType: "application/pdf",
      },
    });
    await storage.remove(replacement.key);

    expect(record).toHaveBeenCalledWith(expect.objectContaining({
      action: "FILE_STORED",
      outcome: "success",
      resourceId: first.key,
    }));
    expect(record).toHaveBeenCalledWith(expect.objectContaining({
      action: "FILE_REPLACED",
      outcome: "success",
      resourceId: replacement.key,
    }));
    expect(record).toHaveBeenCalledWith(expect.objectContaining({
      action: "FILE_REMOVED",
      outcome: "success",
      resourceId: replacement.key,
    }));
  });

  it("does not use the original name as a physical path", async () => {
    const storage = new LocalStorageService({
      rootDirectory,
      generateId: () => FIRST_UUID,
    });

    const stored = await storage.save({
      category: "reports",
      content: Buffer.from("safe"),
      originalName: "../../outside.PDF",
      contentType: "application/pdf",
    });

    expect(stored.key).toBe(
      `reports/${FIRST_UUID}.pdf`
    );

    await expect(
      readFile(
        path.join(
          rootDirectory,
          "reports",
          `${FIRST_UUID}.pdf`
        )
      )
    ).resolves.toEqual(Buffer.from("safe"));
  });

  it("drops an unsafe extension", async () => {
    const storage = new LocalStorageService({
      rootDirectory,
      generateId: () => FIRST_UUID,
    });

    const stored = await storage.save({
      category: "reports",
      content: Buffer.from("safe"),
      originalName: "report.very-long-dangerous-extension",
      contentType: "application/octet-stream",
    });

    expect(stored.key).toBe(
      `reports/${FIRST_UUID}`
    );
  });

  it("does not leave temporary files after saving", async () => {
    const storage = new LocalStorageService({
      rootDirectory,
      generateId: () => FIRST_UUID,
    });

    await storage.save({
      category: "reports",
      content: Buffer.from("content"),
      originalName: "report.pdf",
      contentType: "application/pdf",
    });

    const files = await readdir(
      path.join(rootDirectory, "reports")
    );

    expect(files).toEqual([
      `${FIRST_UUID}.pdf`,
    ]);
  });

  it("opens and streams a stored file", async () => {
    const storage = new LocalStorageService({
      rootDirectory,
      generateId: () => FIRST_UUID,
    });

    const content = Buffer.from("streamed content");

    const stored = await storage.save({
      category: "reports",
      content,
      originalName: "report.pdf",
      contentType: "application/pdf",
    });

    const opened = await storage.open(stored.key);
    const streamedContent = await streamToBuffer(
      opened.stream
    );

    expect(opened.key).toBe(stored.key);
    expect(opened.size).toBe(content.length);
    expect(streamedContent).toEqual(content);
  });

  it("checks existence and removes files idempotently", async () => {
    const storage = new LocalStorageService({
      rootDirectory,
      generateId: () => FIRST_UUID,
    });

    const stored = await storage.save({
      category: "reports",
      content: Buffer.from("content"),
      originalName: "report.pdf",
      contentType: "application/pdf",
    });

    await expect(
      storage.exists(stored.key)
    ).resolves.toBe(true);

    await storage.remove(stored.key);

    await expect(
      storage.exists(stored.key)
    ).resolves.toBe(false);

    await expect(
      storage.remove(stored.key)
    ).resolves.toBeUndefined();
  });

  it("throws a stable not-found error when opening a missing file", async () => {
    const storage = new LocalStorageService({
      rootDirectory,
    });

    const key =
      `reports/${FIRST_UUID}.pdf`;

    await expect(storage.open(key)).rejects.toBeInstanceOf(
      StorageFileNotFoundError
    );

    await expect(storage.open(key)).rejects.toMatchObject({
      statusCode: 404,
      code: "STORAGE_FILE_NOT_FOUND",
      details: {
        key,
      },
    });
  });

  it.each([
    "",
    "/reports/file.pdf",
    "reports/",
    "reports\\file.pdf",
    "../reports/file.pdf",
    "reports/../../secret",
    "unknown/11111111-1111-4111-8111-111111111111.pdf",
    "reports/not-a-uuid.pdf",
    "reports/11111111-1111-4111-8111-111111111111.exe/path",
  ])("rejects invalid storage key: %s", (key) => {
    const storage = new LocalStorageService({
      rootDirectory,
    });

    expect(() => storage.parseKey(key)).toThrow(
      InvalidStorageKeyError
    );
  });

  it("rejects an invalid generated identifier", async () => {
    const storage = new LocalStorageService({
      rootDirectory,
      generateId: () => `${FIRST_UUID}.pdf`,
    });

    await expect(
      storage.save({
        category: "reports",
        content: Buffer.from("content"),
        originalName: "report.pdf",
        contentType: "application/pdf",
      })
    ).rejects.toMatchObject({
      code: "STORAGE_INVALID_GENERATED_ID",
    });
  });

  it("replaces a file and removes the previous file", async () => {
    const generatedIds = [
      FIRST_UUID,
      SECOND_UUID,
    ];

    const storage = new LocalStorageService({
      rootDirectory,
      generateId: () => {
        const id = generatedIds.shift();

        if (!id) {
          throw new Error("No generated id");
        }

        return id;
      },
    });

    const previous = await storage.save({
      category: "reports",
      content: Buffer.from("old"),
      originalName: "old.pdf",
      contentType: "application/pdf",
    });

    const replacement = await storage.replace({
      previousKey: previous.key,
      file: {
        category: "reports",
        content: Buffer.from("new"),
        originalName: "new.pdf",
        contentType: "application/pdf",
      },
    });

    await expect(
      storage.exists(previous.key)
    ).resolves.toBe(false);

    await expect(
      storage.exists(replacement.key)
    ).resolves.toBe(true);

    const opened = await storage.open(replacement.key);

    await expect(
      streamToBuffer(opened.stream)
    ).resolves.toEqual(Buffer.from("new"));
  });

  it("rolls back a replacement when removing the previous file fails", async () => {
    class FailingRemoveStorage extends LocalStorageService {
      override async remove(key: string): Promise<void> {
        if (key.includes(FIRST_UUID)) {
          throw new StorageError(
            "Delete failed",
            "STORAGE_DELETE_FAILED"
          );
        }

        return super.remove(key);
      }
    }

    const storage = new FailingRemoveStorage({
      rootDirectory,
      generateId: () => SECOND_UUID,
    });

    const previousPath = path.join(
      rootDirectory,
      "reports",
      `${FIRST_UUID}.pdf`
    );

    await mkdir(path.dirname(previousPath), {
    recursive: true,
    });

    await writeFile(previousPath, "old");

    await expect(
      storage.replace({
        previousKey:
          `reports/${FIRST_UUID}.pdf`,
        file: {
          category: "reports",
          content: Buffer.from("new"),
          originalName: "new.pdf",
          contentType: "application/pdf",
        },
      })
    ).rejects.toMatchObject({
      code: "STORAGE_DELETE_FAILED",
    });

    await expect(
      storage.exists(
        `reports/${SECOND_UUID}.pdf`
      )
    ).resolves.toBe(false);

    await expect(
      readFile(previousPath, "utf8")
    ).resolves.toBe("old");
  });
});
