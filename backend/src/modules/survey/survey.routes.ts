import { Router } from "express";
import { authenticateJWT } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { UserRole } from "@prisma/client";
import { copySurvey, createQuestion, createSurvey, deleteQuestion, deleteSurvey, getQuestion, getQuestions, getSurvey, reorderQuestions, updateQuestion, updateSurvey } from "./survey.controller";
import { getPublicForm } from "./survey.controller";

const router = Router();
router.use(authenticateJWT, requireRole(UserRole.ADMIN));
router.post("/surveys", createSurvey);
router.get("/surveys/:surveyId", getSurvey);
router.get("/surveys/:surveyId/questions", getQuestions);
router.get("/surveys/:surveyId/questions/:questionId", getQuestion);
router.patch("/surveys/:surveyId", updateSurvey);
router.delete("/surveys/:surveyId", deleteSurvey);
router.post("/surveys/:surveyId/questions", createQuestion);
router.patch("/surveys/:surveyId/questions/reorder", reorderQuestions);
router.patch("/surveys/:surveyId/questions/:questionId", updateQuestion);
router.delete("/surveys/:surveyId/questions/:questionId", deleteQuestion);
router.post("/surveys/:surveyId/copy", copySurvey);
export default router;

export const publicSurveyRouter = Router();
publicSurveyRouter.get("/public/invitations/:token/form", getPublicForm);
