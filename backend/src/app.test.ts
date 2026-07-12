import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app";

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
      .get("/")
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
      .post("/auth/login")
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
});