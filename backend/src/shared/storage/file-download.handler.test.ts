import { Readable } from "node:stream";
import { UserRole } from "@prisma/client";
import express from "express";
import request from "supertest";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { errorHandler } from "../../middlewares/error.middleware";
import { requestIdMiddleware } from "../../middlewares/requestId.middleware";
import {
  InvalidStorageKeyError,
  StorageError,
  StorageFileNotFoundError,
} from "./storage.errors";
import {
  createFileDownloadHandler,
} from "./file-download.handler";
import type {
  FileAccessActor,
  FileAccessPolicy,
} from "./file-access.policy";
import type {
  StorageService,
} from "./storage.service";
import type {
  StorageCategory,
} from "./storage.types";

const FILE_NAME =
  "11111111-1111-4111-8111-111111111111.pdf";

const FILE_KEY = `reports/${FILE_NAME}`;

interface TestDependencies {
  app: express.Express;
  storage: StorageService;
  accessPolicy: FileAccessPolicy;
  openMock: ReturnType<typeof vi.fn>;
  parseKeyMock: ReturnType<typeof vi.fn>;
  authorizeMock: ReturnType<typeof vi.fn>;
  auditRecordMock: ReturnType<typeof vi.fn>;
}

function createTestDependencies(options: {
  actor?: FileAccessActor | null;
  authorization?: {
    downloadName: string;
    contentType: string;
    disposition?: "attachment" | "inline";
  } | null;
  openError?: Error;
  parseError?: Error;
} = {}): TestDependencies {
  const actor =
    options.actor === undefined
      ? {
          id: "student-1",
          role: UserRole.STUDENT,
        }
      : options.actor;

  const parseKeyMock = vi.fn((key: string) => {
    if (options.parseError) {
      throw options.parseError;
    }

    const [category = "", fileName = ""] =
      key.split("/");

    return {
      category: category as StorageCategory,
      fileName,
    };
  });

  const openMock = vi.fn(async (key: string) => {
    if (options.openError) {
      throw options.openError;
    }

    return {
      key,
      stream: Readable.from([
        Buffer.from("file-content"),
      ]),
      size: 12,
    };
  });

  const storage = {
    save: vi.fn(),
    open: openMock,
    exists: vi.fn(),
    remove: vi.fn(),
    replace: vi.fn(),
    parseKey: parseKeyMock,
  } as unknown as StorageService;

  const authorizeMock = vi.fn(async () => {
    if (options.authorization === undefined) {
      return {
        downloadName: "report.pdf",
        contentType: "application/pdf",
        disposition: "attachment" as const,
      };
    }

    return options.authorization;
  });

  const accessPolicy = {
    authorize: authorizeMock,
  } as FileAccessPolicy;
  const auditRecordMock = vi.fn();

  const app = express();

  app.use(requestIdMiddleware);

  if (actor) {
    app.use((req, _res, next) => {
      req.user = actor;
      next();
    });
  }

  app.get(
    "/files/:category/:fileName",
    createFileDownloadHandler({
      storage,
      accessPolicy,
      audit: { record: auditRecordMock },
    })
  );

  app.use(errorHandler);

  return {
    app,
    storage,
    accessPolicy,
    openMock,
    parseKeyMock,
    authorizeMock,
    auditRecordMock,
  };
}

describe("file download handler", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(
      () => undefined
    );
  });

  it("requires an authenticated actor", async () => {
    const dependencies = createTestDependencies({
      actor: null,
    });

    const response = await request(
      dependencies.app
    ).get(`/files/reports/${FILE_NAME}`);

    expect(response.status).toBe(401);
    expect(response.body.code).toBe(
      "AUTH_REQUIRED"
    );

    expect(
      dependencies.parseKeyMock
    ).not.toHaveBeenCalled();

    expect(
      dependencies.authorizeMock
    ).not.toHaveBeenCalled();

    expect(
      dependencies.openMock
    ).not.toHaveBeenCalled();

    expect(dependencies.auditRecordMock).not.toHaveBeenCalled();
  });

  it("authorizes access before opening the physical file", async () => {
    const dependencies = createTestDependencies({
      authorization: null,
    });

    const response = await request(
      dependencies.app
    ).get(`/files/reports/${FILE_NAME}`);

    expect(response.status).toBe(404);

    expect(response.body).toMatchObject({
      code: "FILE_NOT_FOUND",
      message: "Файл не найден",
      details: null,
      requestId: expect.any(String),
    });

    expect(
    dependencies.authorizeMock
    ).toHaveBeenCalledWith({
    actor: {
        id: "student-1",
        role: UserRole.STUDENT,
    },
    key: FILE_KEY,
    requestId: expect.any(String),
    });

    expect(
      dependencies.openMock
    ).not.toHaveBeenCalled();

    expect(dependencies.auditRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "FILE_DOWNLOAD_DENIED",
        outcome: "denied",
        actorId: "student-1",
        resourceId: FILE_KEY,
      })
    );
  });

  it("streams an authorized file with protected headers", async () => {
    const dependencies = createTestDependencies();

    const response = await request(
      dependencies.app
    )
      .get(`/files/reports/${FILE_NAME}`)
      .set("X-Request-Id", "download-success");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe(
      "application/pdf"
    );
    expect(response.headers["content-length"]).toBe(
      "12"
    );
    expect(
      response.headers["content-disposition"]
    ).toBe(
      'attachment; filename="report.pdf"'
    );
    expect(response.headers["cache-control"]).toBe(
      "private, no-store"
    );
    expect(
      response.headers["x-content-type-options"]
    ).toBe("nosniff");
    expect(response.headers["x-request-id"]).toBe(
      "download-success"
    );

    expect(Buffer.isBuffer(response.body)).toBe(true);
    expect(response.body).toEqual(
      Buffer.from("file-content")
    );

    expect(
      dependencies.openMock
    ).toHaveBeenCalledWith(FILE_KEY);

    expect(dependencies.auditRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "FILE_DOWNLOAD_GRANTED",
        outcome: "success",
        actorId: "student-1",
        requestId: "download-success",
        resourceId: FILE_KEY,
      })
    );
  });

  it("supports inline disposition", async () => {
    const dependencies = createTestDependencies({
      authorization: {
        downloadName: "report.pdf",
        contentType: "application/pdf",
        disposition: "inline",
      },
    });

    const response = await request(
      dependencies.app
    ).get(`/files/reports/${FILE_NAME}`);

    expect(response.status).toBe(200);
    expect(
      response.headers["content-disposition"]
    ).toBe(
      'inline; filename="report.pdf"'
    );
  });

  it("sanitizes the download name before writing headers", async () => {
    const dependencies = createTestDependencies({
      authorization: {
        downloadName:
          'report"\r\nX-Injected: yes.pdf',
        contentType: "application/pdf",
      },
    });

    const response = await request(
      dependencies.app
    ).get(`/files/reports/${FILE_NAME}`);

    expect(response.status).toBe(200);

    const disposition =
      response.headers["content-disposition"];

    expect(disposition).toBe(
      'attachment; filename="report___X-Injected: yes.pdf"'
    );

    expect(response.headers["x-injected"]).toBeUndefined();
  });

  it("returns the same safe 404 for a missing physical file", async () => {
    const dependencies = createTestDependencies({
      openError: new StorageFileNotFoundError(
        FILE_KEY
      ),
    });

    const response = await request(
      dependencies.app
    ).get(`/files/reports/${FILE_NAME}`);

    expect(response.status).toBe(404);
    expect(response.body.code).toBe(
      "FILE_NOT_FOUND"
    );
    expect(response.body.details).toBeNull();
  });

  it("does not mask an internal storage failure as 404", async () => {
    const dependencies = createTestDependencies({
      openError: new StorageError(
        "Storage unavailable",
        "STORAGE_READ_FAILED"
      ),
    });

    const response = await request(
      dependencies.app
    ).get(`/files/reports/${FILE_NAME}`);

    expect(response.status).toBe(500);
    expect(response.body.code).toBe(
      "STORAGE_READ_FAILED"
    );
  });

  it("rejects an invalid storage key before policy evaluation", async () => {
    const dependencies = createTestDependencies({
      parseError: new InvalidStorageKeyError(),
    });

    const response = await request(
      dependencies.app
    ).get("/files/reports/not-a-valid-key.pdf");

    expect(response.status).toBe(404);
    expect(response.body.code).toBe(
      "FILE_NOT_FOUND"
    );

    expect(
      dependencies.authorizeMock
    ).not.toHaveBeenCalled();

    expect(
      dependencies.openMock
    ).not.toHaveBeenCalled();
  });
});
