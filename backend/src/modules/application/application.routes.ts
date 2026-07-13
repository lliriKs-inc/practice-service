import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireRole } from "../../middlewares/role.middleware";
import { getForCohort, getMine, listForCohort, listMine, submitApplication, updateStatus } from "./application.controller";

const router = Router();

router.post("/public/invitations/:token/applications", requireRole(UserRole.STUDENT), submitApplication);
router.get("/me/applications", requireRole(UserRole.STUDENT), listMine);
router.get("/me/applications/:applicationId", requireRole(UserRole.STUDENT), getMine);
router.get("/cohorts/:cohortId/applications", requireRole(UserRole.ADMIN), listForCohort);
router.get("/cohorts/:cohortId/applications/:applicationId", requireRole(UserRole.ADMIN), getForCohort);
router.patch("/cohorts/:cohortId/applications/:applicationId/status", requireRole(UserRole.ADMIN), updateStatus);

export default router;
