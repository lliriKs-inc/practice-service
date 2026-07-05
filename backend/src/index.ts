import "dotenv/config";
import express from "express";
import authRoutes from "./modules/auth/auth.routes";
import cohortRoutes from "./modules/cohort/cohort.routes";


const app = express();

const PORT = 3000;

app.use(express.json());
app.use("/auth", authRoutes);
app.use("/cohorts", cohortRoutes);

app.get("/", (_, res) => {
    res.send("Server works!");
});

app.listen(PORT, () => {
    console.log(`Server started on ${PORT}`);
});