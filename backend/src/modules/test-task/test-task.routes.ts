import { Router } from "express";
import { TestTaskController } from "./test-task.controller";
import { requireRole } from "../../middlewares/role.middleware";

const router = Router();
const controller = new TestTaskController();

router.post(
  "/",
  requireRole("ADMIN"),
  controller.create
);

export default router;