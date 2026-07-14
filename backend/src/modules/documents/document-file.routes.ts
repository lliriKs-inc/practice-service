import { UserRole } from "@prisma/client";
import { Router } from "express";
import { requireRole } from "../../middlewares/role.middleware";
import { config } from "../../shared/config";
import { LocalStorageService } from "../../shared/storage";
import { DocumentFileController } from "./document-file.controller";
import { DocumentFileService } from "./document-file.service";

export function createDocumentFileRouter(
  controller = new DocumentFileController(
    new DocumentFileService(
      new LocalStorageService({
        rootDirectory: config.storage.uploadDir,
      })
    )
  )
) {
  const router = Router();

  router.get(
    "/me/applications/:applicationId/report/file",
    requireRole(UserRole.STUDENT),
    controller.getStudentReport.bind(controller)
  );
  router.get(
    "/me/applications/:applicationId/documents/:type/file",
    requireRole(UserRole.STUDENT),
    controller.getStudentDocument.bind(controller)
  );
  router.get(
    "/cohorts/:cohortId/admin/applications/:applicationId/report/file",
    requireRole(UserRole.ADMIN),
    controller.getAdminReport.bind(controller)
  );
  router.get(
    "/cohorts/:cohortId/admin/applications/:applicationId/documents/:type/file",
    requireRole(UserRole.ADMIN),
    controller.getAdminDocument.bind(controller)
  );

  return router;
}

export default createDocumentFileRouter();
