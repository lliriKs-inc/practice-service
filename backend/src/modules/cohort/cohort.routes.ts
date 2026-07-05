import { Router } from "express";
import { CohortController } from "./cohort.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";

const router = Router();
const controller = new CohortController();

router.post(
  "/",
  authMiddleware,
  requireRole("ADMIN"),
  controller.create
);

router.get(
  "/",
  authMiddleware,
  requireRole("ADMIN"),
  controller.getAll
);

router.get(
  "/:id",
  authMiddleware,
  requireRole("ADMIN"),
  controller.getById
);

router.post(
  "/:id/activate",
  authMiddleware,
  requireRole("ADMIN"),
  controller.activate
);

router.get(
  "/active/me",
  authMiddleware,
  requireRole("ADMIN"),
  controller.getActive
);

router.patch(
  "/:id",
  authMiddleware,
  requireRole("ADMIN"),
  controller.update
);

export default router;