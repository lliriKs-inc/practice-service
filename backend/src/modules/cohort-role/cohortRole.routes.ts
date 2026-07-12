import { Router } from "express";
import { CohortRoleController } from "./cohortRole.controller";
import { authenticateJWT } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";

const router = Router();
const controller = new CohortRoleController();

router.post(
  "/roles",
  authenticateJWT,
  requireRole("ADMIN"),
  (req, res) => controller.create(req, res)
);

router.get(
  "/roles",
  authenticateJWT,
  requireRole("ADMIN"),
  (req, res) => controller.getAll(req, res)
);

export default router;