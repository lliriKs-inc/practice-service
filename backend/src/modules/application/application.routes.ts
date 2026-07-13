import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireRole } from "../../middlewares/role.middleware";
import { getForCohort, getMine, listForCohort, listMine, submitApplication, updateStatus } from "./application.controller";
import { TasksController } from "../tasks/tasks.controller";
import { DocumentsController } from "../documents/documents.controller";

const router = Router();
const tasksController = new TasksController();
const documentsController =
  new DocumentsController();

router.post("/public/invitations/:token/applications", requireRole(UserRole.STUDENT), submitApplication);
router.get("/me/applications", requireRole(UserRole.STUDENT), listMine);
router.get("/me/applications/:applicationId", requireRole(UserRole.STUDENT), getMine);
router.get("/cohorts/:cohortId/applications", requireRole(UserRole.ADMIN), listForCohort);
router.get("/cohorts/:cohortId/applications/:applicationId", requireRole(UserRole.ADMIN), getForCohort);
router.patch("/cohorts/:cohortId/applications/:applicationId/status", requireRole(UserRole.ADMIN), updateStatus);
router.put(
  "/me/daily-tasks/:taskId",
  requireRole(UserRole.STUDENT),
  tasksController.updateDailyTask.bind(tasksController)
);
router.get(
  "/me/applications/:applicationId/tasks",
  requireRole(UserRole.STUDENT),
  tasksController.getMyProgress.bind(tasksController)
);
router.get(
  "/cohorts/:cohortId/progress/missed",
  requireRole(UserRole.ADMIN),
  tasksController.getMissedProgress.bind(
    tasksController
  )
);

router.get(
  "/cohorts/:cohortId/progress",
  requireRole(UserRole.ADMIN),
  tasksController.getCohortProgress.bind(tasksController)
);

router.get(
  "/me/applications/:applicationId/documents/readiness",
  requireRole(UserRole.STUDENT),
  documentsController.getApplicationReadiness.bind(
    documentsController
  )
);

router.get(
  "/me/applications/:applicationId/documents",
  requireRole(UserRole.STUDENT),
  documentsController.getApplicationDocuments.bind(
    documentsController
  )
);

router.put(
  "/me/applications/:applicationId/documents/:type/fields/:fieldKey",
  requireRole(UserRole.STUDENT),
  documentsController.updateApplicationDocumentField.bind(
    documentsController
  )
);

export default router;
