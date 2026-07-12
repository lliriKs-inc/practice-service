import "dotenv/config";
import express from "express";
import cors from 'cors';
import { errorHandler } from './middlewares/error.middleware';
import authRoutes from "./modules/auth/auth.routes";
import cohortRoutes from "./modules/cohort/cohort.routes";
import testTaskRoutes from './modules/test-task/test-task.routes';
import { authenticateJWT } from "./middlewares/auth.middleware";
import { cohortContextMiddleware } from "./middlewares/cohortContext.middleware";
import cohortRoleRoutes from "./modules/cohort-role/cohortRole.routes";
import documentsRoutes from "./modules/documents/documents.routes";
import tasksRoutes from "./modules/tasks/tasks.routes";
import adminRoutes from "./modules/admin/admin.routes";
import surveyRoutes from "./modules/survey/survey.routes";
import applicationRouter from './modules/application/application.routes';
import { uploadDir } from "./shared/upload";
import { CohortController } from "./modules/cohort/cohort.controller";
import { SurveyController } from "./modules/survey/survey.controller";
import { config } from "./shared/config";
import { requestIdMiddleware } from "./middlewares/requestId.middleware";

const app = express();
const PORT = config.port;

app.use(requestIdMiddleware);

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
app.use("/uploads", express.static(uploadDir));

app.use("/auth", authRoutes);

const cohortController = new CohortController();
app.get("/cohorts/public/current", cohortController.getPublicCurrent);

const surveyController = new SurveyController();
app.get(
  "/survey-fields",
  surveyController.getPublicCurrentFields.bind(surveyController)
);

app.use(authenticateJWT);
app.use(cohortContextMiddleware);

app.use(surveyRoutes);
app.use(applicationRouter);
app.use('/test-task', authenticateJWT, cohortContextMiddleware, testTaskRoutes);

app.use("/cohorts", cohortRoleRoutes);
app.use("/cohorts", cohortRoutes);
app.use("/documents", documentsRoutes);
app.use("/tasks", tasksRoutes);
app.use("/admin", adminRoutes);

app.get("/", (_, res) => {
    res.send("Server works!");
});

app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`Server started on ${PORT}`);
});