import "dotenv/config";
import express from "express";
import cors from 'cors';
import { errorHandler } from './middlewares/error.middleware';
import authRoutes from "./modules/auth/auth.routes";
import cohortRoutes from "./modules/cohort/cohort.routes";
import testTaskRoutes from './modules/test-task/test-task.routes';
import { authMiddleware } from "./middlewares/auth.middleware";
import { cohortContextMiddleware } from "./middlewares/cohortContext.middleware";
import cohortRoleRoutes from "./modules/cohort-role/cohortRole.routes";
import documentsRoutes from "./modules/documents/documents.routes";
import tasksRoutes from "./modules/tasks/tasks.routes";
import adminRoutes from "./modules/admin/admin.routes";
import surveyRoutes from "./modules/survey/survey.routes";
import applicationRouter from './modules/application/application.routes';
import { uploadDir } from "./shared/upload";
import { CohortController } from "./modules/cohort/cohort.controller";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(uploadDir));

app.use("/auth", authRoutes);

const cohortController = new CohortController();
app.get("/cohorts/public/current", cohortController.getPublicCurrent);

app.use(authMiddleware);
app.use(cohortContextMiddleware);

app.use(surveyRoutes);
app.use(applicationRouter);
app.use('/test-task', authMiddleware, cohortContextMiddleware, testTaskRoutes);

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