import {
  NextFunction,
  Request,
  Response,
} from "express";
import helmet from "helmet";
import {
  rateLimit,
} from "express-rate-limit";
import { config } from "../shared/config";
import {
  appLogger,
} from "../shared/logger/runtime-logger";
import type {
  Logger,
} from "../shared/logger/logger.types";

export interface RateLimiterOptions {
  windowMilliseconds: number;
  maximumRequests: number;
  code: string;
  message: string;
  logger?: Logger;
  skip?: (req: Request) => boolean;
}

export function createSecurityHeaders() {
  return helmet({
    crossOriginResourcePolicy: {
      policy: "same-site",
    },
  });
}

export function createRateLimiter(
  options: RateLimiterOptions
) {
  const logger =
    options.logger ?? appLogger;

  return rateLimit({
    windowMs: options.windowMilliseconds,
    limit: options.maximumRequests,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: options.skip,

    handler: (
      req: Request,
      res: Response,
      _next: NextFunction
    ) => {
      logger.warn("Rate limit exceeded", {
        requestId: req.requestId ?? null,
        actorId: req.user?.id ?? null,
        method: req.method,
        path: req.originalUrl,
        code: options.code,
      });

      return res.status(429).json({
        code: options.code,
        message: options.message,
        details: null,
        requestId: req.requestId ?? null,
      });
    },
  });
}

export function createGeneralRateLimiter(
  logger: Logger = appLogger
) {
  return createRateLimiter({
    windowMilliseconds:
      config.security.rateLimit
        .windowMilliseconds,
    maximumRequests:
      config.security.rateLimit
        .maximumRequests,
    code: "RATE_LIMIT_EXCEEDED",
    message:
      "Слишком много запросов. Повторите попытку позже",
    logger,
  });
}

export function createAuthRateLimiter(
  logger: Logger = appLogger
) {
  return createRateLimiter({
    windowMilliseconds:
      config.security.authRateLimit
        .windowMilliseconds,
    maximumRequests:
      config.security.authRateLimit
        .maximumRequests,
    code: "AUTH_RATE_LIMIT_EXCEEDED",
    message:
      "Слишком много попыток входа. Повторите попытку позже",
    logger,

    skip: (req) => {
      return ![
        "/login",
        "/register",
      ].includes(req.path);
    },
  });
}

export function createUploadRateLimiter(
  logger: Logger = appLogger
) {
  return createRateLimiter({
    windowMilliseconds:
      config.security.uploadRateLimit
        .windowMilliseconds,
    maximumRequests:
      config.security.uploadRateLimit
        .maximumRequests,
    code: "UPLOAD_RATE_LIMIT_EXCEEDED",
    message:
      "Слишком много загрузок файлов. Повторите попытку позже",
    logger,
    skip: (req) => {
      const contentType = req.headers["content-type"];
      const isMutation = ["POST", "PUT", "PATCH"]
        .includes(req.method);

      return !(
        isMutation &&
        typeof contentType === "string" &&
        contentType.toLowerCase().startsWith("multipart/form-data")
      );
    },
  });
}
