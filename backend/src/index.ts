import "dotenv/config";
import express from "express";
import authRoutes from "./modules/auth/auth.routes";
import cohortRoutes from "./modules/cohort/cohort.routes";
import { authMiddleware } from "./middlewares/auth.middleware";
import { cohortContextMiddleware } from "./middlewares/cohortContext.middleware";
import cohortRoleRoutes from "./modules/cohort-role/cohortRole.routes";

const app = express();

const PORT = 3000;

app.use(express.json());
app.use("/auth", authRoutes);
app.use(authMiddleware);
app.use(cohortContextMiddleware);
app.use("/cohorts", cohortRoleRoutes);
app.use("/cohorts", cohortRoutes);
app.get("/", (_, res) => {
    res.send("Server works!");
});

app.listen(PORT, () => {
    console.log(`Server started on ${PORT}`);
});