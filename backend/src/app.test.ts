import {
  mkdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app";
import { config } from "./shared/config";

describe("platform HTTP foundation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns health status without checking the database", async () => {
    const readinessCheck = vi.fn(async () => undefined);
    const app = createApp({ readinessCheck });

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.requestId).toEqual(expect.any(String));
    expect(response.headers["x-request-id"]).toBe(
      response.body.requestId
    );
    expect(readinessCheck).not.toHaveBeenCalled();
  });

  it("preserves a valid incoming request id", async () => {
    const app = createApp({
      readinessCheck: async () => undefined,
    });

    const response = await request(app)
      .get("/health")
      .set("X-Request-Id", "test-request-123");

    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toBe(
      "test-request-123"
    );
    expect(response.body.requestId).toBe("test-request-123");
  });

  it("replaces an invalid incoming request id", async () => {
    const app = createApp({
      readinessCheck: async () => undefined,
    });

    const response = await request(app)
      .get("/health")
      .set("X-Request-Id", "invalid request id");

    expect(response.status).toBe(200);
    expect(response.body.requestId).toEqual(expect.any(String));
    expect(response.body.requestId).not.toBe(
      "invalid request id"
    );
  });

  it("returns ready when the readiness check succeeds", async () => {
    const readinessCheck = vi.fn(async () => undefined);
    const app = createApp({ readinessCheck });

    const response = await request(app).get("/ready");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "ready",
      checks: {
        database: "ok",
      },
    });
    expect(response.body.requestId).toEqual(expect.any(String));
    expect(readinessCheck).toHaveBeenCalledTimes(1);
  });

  it("returns a consistent error when readiness fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const readinessCheck = vi.fn(async () => {
      throw new Error("database unavailable");
    });

    const app = createApp({ readinessCheck });

    const response = await request(app).get("/ready");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      code: "SERVICE_NOT_READY",
      message: "Service is not ready",
      details: {
        database: "unavailable",
      },
      requestId: expect.any(String),
    });
    expect(response.headers["x-request-id"]).toBe(
      response.body.requestId
    );
  });

  it("returns the unified error contract when JWT is missing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp({
      readinessCheck: async () => undefined,
    });

    const response = await request(app)
      .get("/api/v1/me/applications")
      .set("X-Request-Id", "auth-test-request");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      code: "AUTH_TOKEN_MISSING",
      message: "Токен авторизации не предоставлен",
      details: null,
      requestId: "auth-test-request",
    });
  });

  it("returns a controlled error for malformed JSON", async () => {
    const app = createApp({
      readinessCheck: async () => undefined,
    });

    const response = await request(app)
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: "INVALID_JSON",
      message: "Request body contains invalid JSON",
      details: null,
      requestId: expect.any(String),
    });
  });

  it("does not expose the Express powered-by header", async () => {
    const app = createApp({
      readinessCheck: async () => undefined,
    });

    const response = await request(app).get("/health");

    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("configures trust proxy explicitly", () => {
    const app = createApp({
      readinessCheck: async () => undefined,
    });

    expect(app.get("trust proxy")).toBe(false);
  });

  it("applies Helmet headers to health responses", async () => {
    const app = createApp({
      readinessCheck: async () => undefined,
    });

    const response = await request(app)
      .get("/health");

    expect(response.status).toBe(200);

    expect(
      response.headers[
        "x-content-type-options"
      ]
    ).toBe("nosniff");

    expect(
      response.headers[
        "cross-origin-resource-policy"
      ]
    ).toBe("same-site");

    expect(
      response.headers["x-frame-options"]
    ).toBe("SAMEORIGIN");
  });

  it("allows the configured CORS origin", async () => {
    const app = createApp({
      readinessCheck: async () => undefined,
    });

    const response = await request(app)
      .get("/health")
      .set("Origin", config.cors.origin);

    expect(response.status).toBe(200);

    expect(
      response.headers[
        "access-control-allow-origin"
      ]
    ).toBe(config.cors.origin);

    expect(
      response.headers[
        "access-control-expose-headers"
      ]
    ).toBe("Content-Disposition");
  });

  it("does not grant CORS access to another origin", async () => {
    const app = createApp({
      readinessCheck: async () => undefined,
    });

    const response = await request(app)
      .get("/health")
      .set(
        "Origin",
        "https://untrusted.example"
      );

    expect(response.status).toBe(200);

    expect(
      response.headers[
        "access-control-allow-origin"
      ]
    ).toBeUndefined();
  });

  it("does not expose files through the legacy uploads path", async () => {
    const fileName = "private-storage-regression-test.txt";
    const filePath = join(
      config.storage.uploadDir,
      fileName
    );
    const privateContent = "must-not-be-public";

    await mkdir(config.storage.uploadDir, {
      recursive: true,
    });
    await writeFile(filePath, privateContent, "utf8");

    try {
      const app = createApp({
        readinessCheck: async () => undefined,
      });

      const response = await request(app).get(
        `/uploads/${fileName}`
      );

      expect(response.status).toBe(404);
      expect(response.text).not.toContain(privateContent);
    } finally {
      await rm(filePath, {
        force: true,
      });
    }
  });
});
