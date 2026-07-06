import { Router } from "express";
import { requireRole } from "../../middlewares/role.middleware";
import { AdminController } from "./admin.controller";

const router = Router();
const controller = new AdminController();

router.get("/students", requireRole("ADMIN"), controller.getStudents.bind(controller));
router.get("/documents", requireRole("ADMIN"), controller.getDocuments.bind(controller));
router.get("/tasks", requireRole("ADMIN"), controller.getTasks.bind(controller));
router.get("/stats", requireRole("ADMIN"), controller.getStats.bind(controller));
router.get(
  "/documents/:userId",
  requireRole("ADMIN"),
  controller.getStudentDocuments.bind(controller)
);

export default router;