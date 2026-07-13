import express, { type Express } from "express";
import { createErrorHandler } from "../middlewares/error.middleware";
import { authenticateJWT } from "../middlewares/auth.middleware";
import authRoutes from "../modules/auth/auth.routes";
import cohortRoutes from "../modules/cohort/cohort.routes";
import trackRoutes from "../modules/track/track.routes";
import invitationRoutes from "../modules/invitation/invitation.routes";
import surveyRoutes, { publicSurveyRouter } from "../modules/survey/survey.routes";
import applicationRoutes from "../modules/application/application.routes";
import testTaskRoutes from "../modules/test-task/test-task.routes";
import { appLogger } from "../shared/logger/runtime-logger";

/**
 * A-07-only app composition. Production mounting remains owned by Backend B.
 * Public routers are mounted before the JWT gate, matching the target contract.
 */
export function createAdmissionsTestApp(): Express {
  const app = express();
  app.use(express.json());

  app.use("/auth", authRoutes);
  app.use(publicSurveyRouter);
  app.use("/cohorts", cohortRoutes);
  app.use("/invitations", invitationRoutes);

  app.use(authenticateJWT);
  app.use("/tracks", trackRoutes);
  app.use(surveyRoutes);
  app.use(applicationRoutes);
  app.use(testTaskRoutes);

  app.use(createErrorHandler(appLogger));
  return app;
}
