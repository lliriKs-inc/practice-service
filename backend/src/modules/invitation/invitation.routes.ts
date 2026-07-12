import { Router } from "express";
import { createInvitation, validateInvitation } from "./invitation.controller";
import { authenticateJWT } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { UserRole } from "@prisma/client";

const router = Router();

router.post("/validate", validateInvitation);

router.post("/", authenticateJWT, requireRole(UserRole.ADMIN), createInvitation);

export default router;