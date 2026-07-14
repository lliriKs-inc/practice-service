import { Router } from "express";
import { authenticateJWT } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { UserRole } from "@prisma/client";
import { copySurvey, createQuestion, createSurvey, deleteQuestion, deleteSurvey, getQuestion, getQuestions, getSurvey, reorderQuestions, updateQuestion, updateSurvey } from "./survey.controller";
import { getPublicForm } from "./survey.controller";

const router = Router();
const adminOnly = [authenticateJWT, requireRole(UserRole.ADMIN)];
router.post("/surveys", ...adminOnly, createSurvey);
router.get("/surveys/:surveyId", ...adminOnly, getSurvey);
router.get("/surveys/:surveyId/questions", ...adminOnly, getQuestions);
router.get("/surveys/:surveyId/questions/:questionId", ...adminOnly, getQuestion);
router.patch("/surveys/:surveyId", ...adminOnly, updateSurvey);
router.delete("/surveys/:surveyId", ...adminOnly, deleteSurvey);
router.post("/surveys/:surveyId/questions", ...adminOnly, createQuestion);
router.patch("/surveys/:surveyId/questions/reorder", ...adminOnly, reorderQuestions);
router.patch("/surveys/:surveyId/questions/:questionId", ...adminOnly, updateQuestion);
router.delete("/surveys/:surveyId/questions/:questionId", ...adminOnly, deleteQuestion);
router.post("/surveys/:surveyId/copy", ...adminOnly, copySurvey);
export default router;

export const publicSurveyRouter = Router();
publicSurveyRouter.get("/public/invitations/:token/form", getPublicForm);
