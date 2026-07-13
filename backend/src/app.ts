import express from "express";
import cors from "cors";
import {
  createErrorHandler,
} from "./middlewares/error.middleware";
import { requestIdMiddleware } from "./middlewares/requestId.middleware";
import { authenticateJWT } from "./middlewares/auth.middleware";
import { cohortContextMiddleware } from "./middlewares/cohortContext.middleware";
import { config } from "./shared/config";

import authRoutes from "./modules/auth/auth.routes";
import cohortRouter from "./modules/cohort/cohort.routes";
import cohortRoleRoutes from "./modules/cohort-role/cohortRole.routes";
import trackRouter from "./modules/track/track.routes";
import invitationRouter from "./modules/invitation/invitation.routes";
import applicationRouter from "./modules/application/application.routes";
import testTaskRoutes from "./modules/test-task/test-task.routes";
import documentsRoutes from "./modules/documents/documents.routes";
import adminRoutes from "./modules/admin/admin.routes";

import surveyRoutes, { publicSurveyRouter } from "./modules/survey/survey.routes";
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
  createAuthRateLimiter,
  createGeneralRateLimiter,
  createSecurityHeaders,
} from "./middlewares/security.middleware";

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
      origin: config.cors.origin,
    })
  );

  app.use(
    express.json({
      limit: config.http.jsonBodyLimit,
    })
  );

  app.use(createHealthRouter(options.readinessCheck));
  app.use(createGeneralRateLimiter(logger));

  app.use(
    "/auth",
    createAuthRateLimiter(logger),
    authRoutes
  );


  app.use(publicSurveyRouter);

  app.use(authenticateJWT);
  app.use(cohortContextMiddleware);

  app.use(surveyRoutes);
  app.use(applicationRouter);
  app.use("/test-task", testTaskRoutes);
  app.use("/cohorts", cohortRoleRoutes);
  app.use("/cohorts", cohortRouter);
  app.use("/tracks", trackRouter);
  app.use("/invitations", invitationRouter);
  app.use("/documents", documentsRoutes);
  app.use("/admin", adminRoutes);

  app.get("/", (_req, res) => {
    return res.status(200).json({
      status: "ok",
    });
  });

  app.use(createErrorHandler(logger));

  return app;
}
