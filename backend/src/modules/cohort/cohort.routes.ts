import { Router } from "express";
import { CohortController } from "./cohort.controller";
import { authenticateJWT } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { UserRole } from "@prisma/client";

const router = Router();

const controller = new CohortController();

router.get(
    "/public/current",
    controller.getCurrentPublicCohort.bind(controller)
);

const adminOnly = [authenticateJWT, requireRole(UserRole.ADMIN)];
router.get("/", ...adminOnly, controller.listCohorts.bind(controller));
router.get("/:cohortId", ...adminOnly, controller.getCohort.bind(controller));
router.patch("/:cohortId", ...adminOnly, controller.updateCohort.bind(controller));
router.patch("/:cohortId/activate", ...adminOnly, controller.activateCohort.bind(controller));
router.patch("/:cohortId/close", ...adminOnly, controller.closeCohort.bind(controller));
router.delete("/:cohortId", ...adminOnly, controller.deleteCohort.bind(controller));

router.post(
    "/",
    authenticateJWT,
    requireRole(UserRole.ADMIN),
    controller.createCohort.bind(controller)
);

export default router;
