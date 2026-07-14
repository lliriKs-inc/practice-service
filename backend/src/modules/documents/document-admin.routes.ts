import { UserRole } from "@prisma/client";
import { Router } from "express";
import { requireRole } from "../../middlewares/role.middleware";
import { DocumentAdminController } from "./document-admin.controller";

export function createDocumentAdminRouter(
  controller = new DocumentAdminController()
) {
  const router = Router();

  router.put(
    "/cohorts/:cohortId/admin/applications/:applicationId/documents/:type/fields/:fieldKey",
    requireRole(UserRole.ADMIN),
    controller.updateField.bind(controller)
  );

  return router;
}

export default createDocumentAdminRouter();
