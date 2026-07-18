import express from "express";
import cors from "cors";
import {
  createErrorHandler,
} from "./middlewares/error.middleware";
import { requestIdMiddleware } from "./middlewares/requestId.middleware";
import { config } from "./shared/config";
import {
  createHealthRouter,
  ReadinessCheck,
} from "./modules/health/health.routes";
import {
  appLogger,
} from "./shared/logger/runtime-logger";
import type {
  Logger,
} from "./shared/logger/logger.types";

import {
  createGeneralRateLimiter,
  createSecurityHeaders,
  createUploadRateLimiter,
} from "./middlewares/security.middleware";
import { createApiV1Router } from "./routes/api-v1.routes";

export interface CreateAppOptions {
  readinessCheck?: ReadinessCheck;
  logger?: Logger;
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const logger = options.logger ?? appLogger;

  app.set(
  "trust proxy",
  config.security.trustProxyHops === 0
    ? false
    : config.security.trustProxyHops
);

  app.disable("x-powered-by");

  app.use(requestIdMiddleware);
  app.use(createSecurityHeaders());

  app.use(
    cors({
      origin: (origin, callback) => {
        if (
          !origin ||
          config.cors.origins.includes(origin)
        ) {
          callback(null, true);
          return;
        }

        callback(null, false);
      },
      credentials: true,
      exposedHeaders: ["Content-Disposition"],
    })
  );

  app.use(
    express.json({
      limit: config.http.jsonBodyLimit,
    })
  );

  app.use(createHealthRouter(options.readinessCheck));
  app.use(createGeneralRateLimiter(logger));
  app.use(createUploadRateLimiter(logger));

  app.use("/api/v1", createApiV1Router(logger));

  app.get("/", (_req, res) => {
    return res.status(200).json({
      status: "ok",
    });
  });

  app.use(createErrorHandler(logger));

  return app;
}
