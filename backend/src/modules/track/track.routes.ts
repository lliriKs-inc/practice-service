import { Router } from "express";
import { createTrack, getTracks } from "./track.controller";
import { authenticateJWT } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { cohortContextMiddleware } from "../../middlewares/cohortContext.middleware";
import { UserRole } from "@prisma/client";

const router = Router();

router.post("/", authenticateJWT, requireRole(UserRole.ADMIN), createTrack);

router.get("/", authenticateJWT, cohortContextMiddleware, getTracks);

export default router;