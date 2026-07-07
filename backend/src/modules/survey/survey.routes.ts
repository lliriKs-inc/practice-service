import { Router } from "express";
import { SurveyController } from "./survey.controller";
import { requireRole } from "../../middlewares/role.middleware";

const router = Router();
const controller = new SurveyController();

router.post(
  "/survey-fields",
  requireRole("ADMIN"),
  controller.createField
);

router.get(
  "/survey-fields",
  controller.getAllFields
);

router.get(
  "/survey-fields/:id",
  controller.getFieldById
);

router.patch(
  "/survey-fields/:id",
  requireRole("ADMIN"),
  controller.updateField
);

router.delete(
  "/survey-fields/:id",
  requireRole("ADMIN"),
  controller.deleteField
);

export default router;