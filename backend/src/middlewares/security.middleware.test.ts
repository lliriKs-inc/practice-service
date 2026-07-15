import express from "express";
import request from "supertest";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { requestIdMiddleware } from "./requestId.middleware";
import {
  createAuthRateLimiter,
  createRateLimiter,
  createSecurityHeaders,
  createUploadRateLimiter,
} from "./security.middleware";
import { config } from "../shared/config";
import type {
  Logger,
} from "../shared/logger";

function createLoggerMock(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe("security middleware", () => {
  let logger: Logger;

  beforeEach(() => {
    logger = createLoggerMock();
  });

  it("adds security headers and removes framework disclosure", async () => {
    const app = express();

    app.disable("x-powered-by");
    app.use(createSecurityHeaders());

    app.get("/health", (_req, res) => {
      return res.status(200).json({
        status: "ok",
      });
    });

    const response = await request(app)
      .get("/health");

    expect(response.status).toBe(200);
    expect(
      response.headers["x-powered-by"]
    ).toBeUndefined();

    expect(
      response.headers[
        "x-content-type-options"
      ]
    ).toBe("nosniff");

    expect(
      response.headers["x-frame-options"]
    ).toBe("SAMEORIGIN");

    expect(
      response.headers[
        "cross-origin-resource-policy"
      ]
    ).toBe("same-site");

    expect(
      response.headers[
        "content-security-policy"
      ]
    ).toEqual(expect.any(String));
  });

  it("returns a consistent 429 response", async () => {
    const app = express();

    app.use(requestIdMiddleware);

    app.use(
      createRateLimiter({
        windowMilliseconds: 60_000,
        maximumRequests: 2,
        code: "TEST_RATE_LIMIT",
        message: "Too many test requests",
        logger,
      })
    );

    app.get("/resource", (_req, res) => {
      return res.status(200).json({
        status: "ok",
      });
    });

    await request(app).get("/resource");
    await request(app).get("/resource");

    const response = await request(app)
      .get("/resource")
      .set("X-Request-Id", "rate-limited");

    expect(response.status).toBe(429);

    expect(response.body).toEqual({
      code: "TEST_RATE_LIMIT",
      message: "Too many test requests",
      details: null,
      requestId: "rate-limited",
    });

    expect(logger.warn).toHaveBeenCalledWith(
      "Rate limit exceeded",
      {
        requestId: "rate-limited",
        actorId: null,
        method: "GET",
        path: "/resource",
        code: "TEST_RATE_LIMIT",
      }
    );
  });

  it("applies the strict auth limit only to login and register", async () => {
    const app = express();

    app.use(requestIdMiddleware);

    app.use(
      "/auth",
      createRateLimiter({
        windowMilliseconds: 60_000,
        maximumRequests: 1,
        code: "AUTH_RATE_LIMIT_EXCEEDED",
        message: "Too many auth attempts",
        logger,
        skip: (req) =>
          ![
            "/login",
            "/register",
          ].includes(req.path),
      })
    );

    app.post(
      "/auth/login",
      (_req, res) => {
        return res.status(200).json({
          status: "login",
        });
      }
    );

    app.get("/auth/me", (_req, res) => {
      return res.status(200).json({
        status: "me",
      });
    });

    const firstLogin = await request(app)
      .post("/auth/login");

    const secondLogin = await request(app)
      .post("/auth/login");

    const firstMe = await request(app)
      .get("/auth/me");

    const secondMe = await request(app)
      .get("/auth/me");

    expect(firstLogin.status).toBe(200);
    expect(secondLogin.status).toBe(429);
    expect(firstMe.status).toBe(200);
    expect(secondMe.status).toBe(200);
  });

  it("creates the configured auth limiter", async () => {
    const app = express();

    app.use(requestIdMiddleware);
    app.use("/auth", createAuthRateLimiter(logger));

    app.get("/auth/me", (_req, res) => {
      return res.status(200).json({
        status: "ok",
      });
    });

    const response = await request(app)
      .get("/auth/me");

    expect(response.status).toBe(200);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("limits multipart mutations without throttling ordinary requests", async () => {
    const app = express();

    app.use(requestIdMiddleware);
    app.use(createUploadRateLimiter(logger));
    app.post("/resource", (_req, res) => {
      return res.status(200).json({ status: "ok" });
    });

    await request(app).post("/resource").send({ value: "one" });
    await request(app).post("/resource").send({ value: "two" });

    let response: request.Response | undefined;
    for (
      let attempt = 0;
      attempt <= config.security.uploadRateLimit.maximumRequests;
      attempt += 1
    ) {
      response = await request(app)
        .post("/resource")
        .attach("file", Buffer.from("content"), "report.pdf");
    }

    expect(response?.status).toBe(429);
    expect(response?.body.code).toBe("UPLOAD_RATE_LIMIT_EXCEEDED");
  });
});
