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
import cohortRoutes from "./modules/cohort/cohort.routes";
import cohortRoleRoutes from "./modules/cohort-role/cohortRole.routes";
import surveyRoutes from "./modules/survey/survey.routes";
import applicationRouter from "./modules/application/application.routes";
import testTaskRoutes from "./modules/test-task/test-task.routes";
import documentsRoutes from "./modules/documents/documents.routes";
import tasksRoutes from "./modules/tasks/tasks.routes";
import adminRoutes from "./modules/admin/admin.routes";

import { CohortController } from "./modules/cohort/cohort.controller";
import { SurveyController } from "./modules/survey/survey.controller";
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

  const cohortController = new CohortController();

  app.get(
    "/cohorts/public/current",
    cohortController.getPublicCurrent
  );

  const surveyController = new SurveyController();

  app.get(
    "/survey-fields",
    surveyController.getPublicCurrentFields.bind(surveyController)
  );

  app.use(authenticateJWT);
  app.use(cohortContextMiddleware);

  app.use(surveyRoutes);
  app.use(applicationRouter);
  app.use("/test-task", testTaskRoutes);
  app.use("/cohorts", cohortRoleRoutes);
  app.use("/cohorts", cohortRoutes);
  app.use("/documents", documentsRoutes);
  app.use("/tasks", tasksRoutes);
  app.use("/admin", adminRoutes);

  app.get("/", (_req, res) => {
    return res.status(200).json({
      status: "ok",
    });
  });

  app.use(createErrorHandler(logger));

  return app;
}