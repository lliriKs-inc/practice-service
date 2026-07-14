import { Router } from "express";
import { createNestedTrack, createTrack, deleteNestedTrack, getNestedTracks, getTracks, updateNestedTrack } from "./track.controller";
import { authenticateJWT } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { cohortContextMiddleware } from "../../middlewares/cohortContext.middleware";
import { UserRole } from "@prisma/client";

const router = Router();

router.post("/", authenticateJWT, requireRole(UserRole.ADMIN), createTrack);

router.get("/", authenticateJWT, cohortContextMiddleware, getTracks);

export default router;

export const nestedTrackRoutes = Router();
nestedTrackRoutes.get("/cohorts/:cohortId/tracks", authenticateJWT, requireRole(UserRole.ADMIN), getNestedTracks);
nestedTrackRoutes.post("/cohorts/:cohortId/tracks", authenticateJWT, requireRole(UserRole.ADMIN), createNestedTrack);
nestedTrackRoutes.patch("/cohorts/:cohortId/tracks/:trackId", authenticateJWT, requireRole(UserRole.ADMIN), updateNestedTrack);
nestedTrackRoutes.delete("/cohorts/:cohortId/tracks/:trackId", authenticateJWT, requireRole(UserRole.ADMIN), deleteNestedTrack);
