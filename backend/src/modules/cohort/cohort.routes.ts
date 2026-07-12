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

router.post(
    "/",
    authenticateJWT,
    requireRole(UserRole.ADMIN),
    controller.createCohort.bind(controller)
);

export default router;