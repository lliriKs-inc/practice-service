import express from "express";
import request from "supertest";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  AppError,
  createErrorHandler,
} from "./error.middleware";
import { requestIdMiddleware } from "./requestId.middleware";
import type {
  Logger,
} from "../shared/logger";
import { UserRole } from "@prisma/client";

function createLoggerMock(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function createErrorTestApp(logger: Logger) {
  const app = express();

  app.use(requestIdMiddleware);
  app.use(express.json());

  app.get(
    "/operational",
    (req, _res, next) => {
      req.user = {
        id: "student-1",
        role: UserRole.STUDENT,
      };

      next(
        new AppError(
          "Access denied",
          403,
          "ACCESS_DENIED"
        )
      );
    }
  );

  app.get("/unexpected", () => {
    throw new Error("Database password leaked");
  });

  app.post("/json", (_req, res) => {
    return res.status(200).json({
      status: "ok",
    });
  });

  app.use(createErrorHandler(logger));

  return app;
}

describe("error handler logging", () => {
  let logger: Logger;

  beforeEach(() => {
    logger = createLoggerMock();
  });

  it("logs operational 4xx errors at warn level", async () => {
    const app = createErrorTestApp(logger);

    const response = await request(app)
      .get("/operational")
      .set("X-Request-Id", "request-warn");

    expect(response.status).toBe(403);

    expect(response.body).toEqual({
      code: "ACCESS_DENIED",
      message: "Access denied",
      details: null,
      requestId: "request-warn",
    });

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();

    expect(logger.warn).toHaveBeenCalledWith(
      "HTTP request rejected",
      {
        requestId: "request-warn",
        actorId: "student-1",
        method: "GET",
        path: "/operational",
        code: "ACCESS_DENIED",
        statusCode: 403,
        error: expect.any(AppError),
      }
    );
  });

  it("logs unexpected errors at error level", async () => {
    const app = createErrorTestApp(logger);

    const response = await request(app)
      .get("/unexpected")
      .set("X-Request-Id", "request-error");

    expect(response.status).toBe(500);

    expect(response.body).toEqual({
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error",
      details: null,
      requestId: "request-error",
    });

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();

    expect(logger.error).toHaveBeenCalledWith(
      "HTTP request failed",
      {
        requestId: "request-error",
        actorId: null,
        method: "GET",
        path: "/unexpected",
        code: "INTERNAL_SERVER_ERROR",
        statusCode: 500,
        error: expect.any(Error),
      }
    );

    expect(JSON.stringify(response.body)).not.toContain(
      "Database password leaked"
    );
  });

  it("returns invalid JSON without logging it as a server failure", async () => {
    const app = createErrorTestApp(logger);

    const response = await request(app)
      .post("/json")
      .set("Content-Type", "application/json")
      .send('{"invalid":');

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(
      "INVALID_JSON"
    );

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});