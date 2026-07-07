import { Router } from "express";
import { TestTaskController } from "./test-task.controller";
import { requireRole } from "../../middlewares/role.middleware";

const router = Router();
const controller = new TestTaskController();

router.post("/", requireRole("ADMIN"), controller.create);
router.get("/", controller.getAll);

router.patch("/:id", requireRole("ADMIN"), controller.update);
router.post("/:id/publish", requireRole("ADMIN"), controller.publish);

export default router;