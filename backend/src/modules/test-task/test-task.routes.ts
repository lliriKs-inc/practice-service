import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireRole } from "../../middlewares/role.middleware";
import { config } from "../../shared/config";
import {
  createFileDownloadHandler,
  LocalStorageService,
} from "../../shared/storage";
import { createSingleFileUpload } from "../../shared/upload/index";
import { TestTaskController } from "./test-task.controller";
import { TestTaskFileAccessPolicy } from "./test-task.file-access.policy";
import { TestTaskService } from "./test-task.service";

const router = Router();
const controller = new TestTaskController();

const taskFileUpload = createSingleFileUpload({ category: "test-tasks" });
const submissionFileUpload = createSingleFileUpload({ category: "test-task-submissions" });
const fileService = new TestTaskService();
const fileDownload = createFileDownloadHandler({
  storage: new LocalStorageService({ rootDirectory: config.storage.uploadDir }),
  accessPolicy: new TestTaskFileAccessPolicy(fileService),
});

router.get(
  "/cohorts/:cohortId/tracks/:trackId/test-task",
  requireRole(UserRole.ADMIN),
  controller.getForAdmin.bind(controller),
);
router.put(
  "/cohorts/:cohortId/tracks/:trackId/test-task",
  requireRole(UserRole.ADMIN),
  controller.upsert.bind(controller),
);
router.post(
  "/cohorts/:cohortId/tracks/:trackId/test-task/file",
  requireRole(UserRole.ADMIN),
  taskFileUpload,
  controller.uploadFile.bind(controller),
);
router.post(
  "/cohorts/:cohortId/tracks/:trackId/test-task/publish",
  requireRole(UserRole.ADMIN),
  controller.publish.bind(controller),
);
router.delete(
  "/cohorts/:cohortId/tracks/:trackId/test-task",
  requireRole(UserRole.ADMIN),
  controller.delete.bind(controller),
);

router.get(
  "/me/applications/:applicationId/test-task",
  requireRole(UserRole.STUDENT),
  controller.getForStudent.bind(controller),
);
router.put(
  "/me/applications/:applicationId/test-task-submission",
  requireRole(UserRole.STUDENT),
  submissionFileUpload,
  controller.replaceSubmission.bind(controller),
);
router.get(
  "/me/applications/:applicationId/test-task-submission",
  requireRole(UserRole.STUDENT),
  controller.getMine.bind(controller),
);
router.get(
  "/cohorts/:cohortId/applications/:applicationId/test-task-submission",
  requireRole(UserRole.ADMIN),
  controller.getSubmissionForAdmin.bind(controller),
);

router.get(
  "/files/:category/:fileName",
  requireRole(UserRole.STUDENT, UserRole.ADMIN),
  fileDownload,
);

export default router;
