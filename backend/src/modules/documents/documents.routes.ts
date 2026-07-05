import { Router } from "express";
import { DocumentsController } from "./documents.controller";
import { reportUpload } from "../../shared/upload";
import { requireRole } from "../../middlewares/role.middleware";

const router = Router();
const controller = new DocumentsController();
router.get("/readiness", controller.getReadiness.bind(controller));
router.get("/generate/:type", controller.generate.bind(controller));
router.get("/", controller.getMyDocuments.bind(controller));
router.post("/", controller.create.bind(controller));
router.patch("/", controller.update.bind(controller));
router.post(
  "/report",
  reportUpload.single("report"),
  controller.uploadReport.bind(controller)
);

router.patch(
  "/review",
  requireRole("ADMIN"),
  controller.updateReview.bind(controller)
);

router.patch(
  "/approve",
  requireRole("ADMIN"),
  controller.approveReport.bind(controller)
);

export default router;