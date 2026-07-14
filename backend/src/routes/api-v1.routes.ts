import { Router } from "express";
import { AppError } from "../middlewares/error.middleware";
import { authenticateJWT } from "../middlewares/auth.middleware";
import { cohortContextMiddleware } from "../middlewares/cohortContext.middleware";
import { createAuthRateLimiter } from "../middlewares/security.middleware";
import type { Logger } from "../shared/logger/logger.types";
import { API_V1_MOUNTS } from "./api-v1.registry";

export function createApiV1Router(logger: Logger) {
  const router = Router();

  for (const mount of API_V1_MOUNTS.filter(
    (entry) => entry.phase === "public"
  )) {
    if (mount.id === "auth") {
      router.use(
        mount.prefix,
        createAuthRateLimiter(logger),
        mount.router
      );
      continue;
    }

    router.use(mount.prefix, mount.router);
  }

  router.use(authenticateJWT);
  router.use(cohortContextMiddleware);

  for (const mount of API_V1_MOUNTS.filter(
    (entry) => entry.phase === "private"
  )) {
    router.use(mount.prefix, mount.router);
  }

  router.use((req, _res, next) =>
    next(
      new AppError(
        `Route ${req.method} ${req.originalUrl} not found`,
        404,
        "ROUTE_NOT_FOUND"
      )
    )
  );

  return router;
}
