import { Router } from "express";
import { createCohortInvitation, createInvitation, deleteCohortInvitation, validateInvitation } from "./invitation.controller";
import { authenticateJWT } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { UserRole } from "@prisma/client";

const router = Router();

router.post("/validate", validateInvitation);

router.post("/", authenticateJWT, requireRole(UserRole.ADMIN), createInvitation);

export default router;

export const nestedInvitationRoutes = Router();
nestedInvitationRoutes.post("/cohorts/:cohortId/invitation", authenticateJWT, requireRole(UserRole.ADMIN), createCohortInvitation);
nestedInvitationRoutes.post("/cohorts/:cohortId/invitation/regenerate", authenticateJWT, requireRole(UserRole.ADMIN), createCohortInvitation);
nestedInvitationRoutes.delete("/cohorts/:cohortId/invitation", authenticateJWT, requireRole(UserRole.ADMIN), deleteCohortInvitation);
