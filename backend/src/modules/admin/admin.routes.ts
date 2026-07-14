import { UserRole } from "@prisma/client";
import { Router } from "express";
import { requireRole } from "../../middlewares/role.middleware";
import { AdminController } from "./admin.controller";

export function createAdminRouter(
  controller = new AdminController()
) {
  const router = Router();
  const adminOnly = requireRole(UserRole.ADMIN);

  router.get(
    "/cohorts/:cohortId/admin/applications",
    adminOnly,
    controller.getApplications.bind(controller)
  );
  router.get(
    "/cohorts/:cohortId/admin/applications/:applicationId",
    adminOnly,
    controller.getApplication.bind(controller)
  );
  router.get(
    "/cohorts/:cohortId/admin/documents",
    adminOnly,
    controller.getDocuments.bind(controller)
  );
  router.get(
    "/cohorts/:cohortId/admin/documents/:applicationId",
    adminOnly,
    controller.getApplicationDocuments.bind(controller)
  );
  router.get(
    "/cohorts/:cohortId/admin/overview",
    adminOnly,
    controller.getOverview.bind(controller)
  );

  return router;
}

export default createAdminRouter();
