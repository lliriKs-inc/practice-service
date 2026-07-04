import "dotenv/config";
import express from "express";
import authRoutes from "./modules/auth/auth.routes";


const app = express();

const PORT = 3000;

app.use(express.json());
app.use("/auth", authRoutes);

app.get("/", (_, res) => {
    res.send("Server works!");
});

app.listen(PORT, () => {
    console.log(`Server started on ${PORT}`);
});