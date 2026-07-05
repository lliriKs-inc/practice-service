import "dotenv/config";
import express from "express";
import cors from 'cors';
import { errorHandler } from './middlewares/error.middleware';
import authRoutes from "./modules/auth/auth.routes";
import cohortRoutes from "./modules/cohort/cohort.routes";
import { authMiddleware } from "./middlewares/auth.middleware";
import { cohortContextMiddleware } from "./middlewares/cohortContext.middleware";
import cohortRoleRoutes from "./modules/cohort-role/cohortRole.routes";
import documentsRoutes from "./modules/documents/documents.routes";
import { uploadDir } from "./shared/upload";

const app = express();

const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(uploadDir));
app.use("/auth", authRoutes);
app.use(authMiddleware);
app.use(cohortContextMiddleware);
app.use("/cohorts", cohortRoleRoutes);
app.use("/cohorts", cohortRoutes);
app.use("/documents", documentsRoutes);

app.get("/", (_, res) => {
    res.send("Server works!");
});

app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`Server started on ${PORT}`);
});