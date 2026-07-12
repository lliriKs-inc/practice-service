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
import { config } from "../config";
import type {
  StorageCategory,
} from "../storage";
import {
  createSingleFileUpload,
} from "./index";

function createUploadTestApp(
  category: StorageCategory = "reports"
) {
  const app = express();

  app.use(requestIdMiddleware);

  app.post(
    "/upload",
    createSingleFileUpload({
      category,
      fieldName: "file",
    }),
    (req, res) => {
      const upload = req.storageUpload;

      if (!upload) {
        throw new Error(
          "Validated upload was not attached to request"
        );
      }

      return res.status(201).json({
        category: upload.category,
        originalName: upload.originalName,
        contentType: upload.contentType,
        content: upload.content.toString("utf8"),
        size: upload.content.length,
        requestId: req.requestId ?? null,
      });
    }
  );

  app.use(errorHandler);

  return app;
}

describe("memory upload middleware", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(
      () => undefined
    );
  });

  it("accepts one valid file and keeps it in memory", async () => {
    const app = createUploadTestApp();

    const response = await request(app)
      .post("/upload")
      .set("X-Request-Id", "upload-success")
      .attach(
        "file",
        Buffer.from("pdf-content"),
        {
          filename: "report.pdf",
          contentType: "application/pdf",
        }
      );

    expect(response.status).toBe(201);

    expect(response.body).toEqual({
      category: "reports",
      originalName: "report.pdf",
      contentType: "application/pdf",
      content: "pdf-content",
      size: 11,
      requestId: "upload-success",
    });
  });

  it("rejects a request without a file", async () => {
    const app = createUploadTestApp();

    const response = await request(app)
      .post("/upload")
      .set("X-Request-Id", "missing-file");

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      code: "UPLOAD_FILE_REQUIRED",
      message: "Файл не был передан",
      details: {
        fieldName: "file",
      },
      requestId: "missing-file",
    });
  });

  it("rejects an unexpected multipart field", async () => {
    const app = createUploadTestApp();

    const response = await request(app)
      .post("/upload")
      .attach(
        "wrong-field",
        Buffer.from("pdf-content"),
        {
          filename: "report.pdf",
          contentType: "application/pdf",
        }
      );

    expect(response.status).toBe(400);

    expect(response.body).toMatchObject({
      code: "UPLOAD_UNEXPECTED_FIELD",
      details: {
        fieldName: "wrong-field",
      },
      requestId: expect.any(String),
    });
  });

  it("rejects more than one file", async () => {
    const app = createUploadTestApp();

    const response = await request(app)
      .post("/upload")
      .attach(
        "file",
        Buffer.from("first"),
        {
          filename: "first.pdf",
          contentType: "application/pdf",
        }
      )
      .attach(
        "file",
        Buffer.from("second"),
        {
          filename: "second.pdf",
          contentType: "application/pdf",
        }
      );

    expect(response.status).toBe(400);

    expect([
      "UPLOAD_TOO_MANY_FILES",
      "UPLOAD_UNEXPECTED_FIELD",
    ]).toContain(response.body.code);

    expect(response.body.requestId).toEqual(
      expect.any(String)
    );
  });

  it("rejects an empty uploaded file", async () => {
    const app = createUploadTestApp();

    const response = await request(app)
      .post("/upload")
      .attach(
        "file",
        Buffer.alloc(0),
        {
          filename: "empty.pdf",
          contentType: "application/pdf",
        }
      );

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(
      "UPLOAD_FILE_EMPTY"
    );
  });

  it("rejects a MIME and extension mismatch", async () => {
    const app = createUploadTestApp();

    const response = await request(app)
      .post("/upload")
      .attach(
        "file",
        Buffer.from("executable"),
        {
          filename: "malware.exe",
          contentType: "application/pdf",
        }
      );

    expect(response.status).toBe(400);

    expect(response.body).toMatchObject({
      code: "UPLOAD_FILE_TYPE_NOT_ALLOWED",
      details: {
        contentType: "application/pdf",
        extension: ".exe",
      },
    });
  });

  it("rejects a file above the configured size limit", async () => {
    const app = createUploadTestApp();

    const oversizedContent = Buffer.alloc(
      config.storage.maxFileSizeBytes + 1,
      1
    );

    const response = await request(app)
      .post("/upload")
      .attach(
        "file",
        oversizedContent,
        {
          filename: "large.pdf",
          contentType: "application/pdf",
        }
      );

    expect(response.status).toBe(413);

    expect(response.body).toMatchObject({
      code: "UPLOAD_FILE_TOO_LARGE",
      details: {
        actualSize: null,
        maximumSize:
          config.storage.maxFileSizeBytes,
      },
      requestId: expect.any(String),
    });
  });

  it("accepts ZIP for a test task submission", async () => {
    const app = createUploadTestApp(
      "test-task-submissions"
    );

    const response = await request(app)
      .post("/upload")
      .attach(
        "file",
        Buffer.from("zip-content"),
        {
          filename: "solution.zip",
          contentType: "application/zip",
        }
      );

    expect(response.status).toBe(201);

    expect(response.body).toMatchObject({
      category: "test-task-submissions",
      originalName: "solution.zip",
      contentType: "application/zip",
      content: "zip-content",
    });
  });
});