import express from "express";

const app = express();

const PORT = 3000;

app.get("/", (_, res) => {
    res.send("Server works!");
});

app.listen(PORT, () => {
    console.log(`Server started on ${PORT}`);
});