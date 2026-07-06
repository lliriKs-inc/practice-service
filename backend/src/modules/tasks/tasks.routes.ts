import { Router } from "express";
import { requireRole } from "../../middlewares/role.middleware";
import { TasksController } from "./tasks.controller";

const router = Router();
const controller = new TasksController();

router.get("/week", controller.getWeek.bind(controller));
router.get("/all/week", requireRole("ADMIN"), controller.getAllWeek.bind(controller));
router.get("/all", requireRole("ADMIN"), controller.getAll.bind(controller));
router.get("/", controller.getMine.bind(controller));
router.post("/", controller.create.bind(controller));
router.patch("/:id", controller.update.bind(controller));
router.delete("/:id", controller.delete.bind(controller));

export default router;