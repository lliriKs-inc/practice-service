import { Router } from "express";
import { CohortController } from "./cohort.controller";
import { requireRole } from "../../middlewares/role.middleware";
import { validateCreateCohort, validateUpdateCohort } from "../../middlewares/cohortValidation.middleware";

const router = Router();
const controller = new CohortController();

router.post(
  "/",
  requireRole("ADMIN"),
  validateCreateCohort,
  controller.create
);

router.get(
  "/",
  requireRole("ADMIN"),
  controller.getAll
);

router.get(
  "/active/me",
  requireRole("ADMIN"),
  controller.getActive
);

router.get(
  "/:id",
  requireRole("ADMIN"),
  controller.getById
);

router.post(
  "/:id/activate",
  requireRole("ADMIN"),
  controller.activate
);

router.patch(
  "/:id",
  requireRole("ADMIN"),
  validateUpdateCohort,
  controller.update
);

export default router;