import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middlewares/error.middleware";
import { SurveyService } from "./survey.service";
import { copySurveySchema, createQuestionSchema, createSurveySchema, reorderQuestionsSchema, updateQuestionSchema, updateSurveySchema } from "./dto/survey.dto";

const service = new SurveyService();
const id = (req: Request, key: string) => typeof req.params[key] === "string" ? req.params[key] : (() => { throw new AppError("Invalid route parameter", 400, "VALIDATION_ERROR"); })();
const parse = <T>(result: { success: boolean; data?: T; error?: { issues: unknown } }): T => { if (!result.success) throw new AppError("Request validation failed", 400, "VALIDATION_ERROR", result.error?.issues); return result.data as T; };

export async function createSurvey(req: Request, res: Response, next: NextFunction) { try { return res.status(201).json(await service.createSurvey(parse(createSurveySchema.safeParse(req.body)))); } catch (e) { return next(e); } }
export async function getSurvey(req: Request, res: Response, next: NextFunction) { try { const result = await service.getSurvey(id(req, "surveyId")); if (!result) return next(new AppError("Survey not found", 404, "SURVEY_NOT_FOUND")); return res.json(result); } catch (e) { return next(e); } }
export async function getQuestions(req: Request, res: Response, next: NextFunction) { try { return res.json(await service.getQuestions(id(req, "surveyId"))); } catch (e) { return next(e); } }
export async function getQuestion(req: Request, res: Response, next: NextFunction) { try { return res.json(await service.getQuestion(id(req, "surveyId"), id(req, "questionId"))); } catch (e) { return next(e); } }
export async function updateSurvey(req: Request, res: Response, next: NextFunction) { try { const data = parse(updateSurveySchema.safeParse(req.body)); return res.json(await service.updateSurvey(id(req, "surveyId"), data.title)); } catch (e) { return next(e); } }
export async function deleteSurvey(req: Request, res: Response, next: NextFunction) { try { await service.deleteSurvey(id(req, "surveyId")); return res.status(204).send(); } catch (e) { return next(e); } }
export async function createQuestion(req: Request, res: Response, next: NextFunction) { try { return res.status(201).json(await service.createQuestion(id(req, "surveyId"), parse(createQuestionSchema.safeParse(req.body)))); } catch (e) { return next(e); } }
export async function updateQuestion(req: Request, res: Response, next: NextFunction) { try { return res.json(await service.updateQuestion(id(req, "surveyId"), id(req, "questionId"), parse(updateQuestionSchema.safeParse(req.body)))); } catch (e) { return next(e); } }
export async function deleteQuestion(req: Request, res: Response, next: NextFunction) { try { await service.deleteQuestion(id(req, "surveyId"), id(req, "questionId")); return res.status(204).send(); } catch (e) { return next(e); } }
export async function reorderQuestions(req: Request, res: Response, next: NextFunction) { try { const data = parse(reorderQuestionsSchema.safeParse(req.body)); return res.json(await service.reorderQuestions(id(req, "surveyId"), data.question_ids)); } catch (e) { return next(e); } }
export async function copySurvey(req: Request, res: Response, next: NextFunction) { try { const data = parse(copySurveySchema.safeParse(req.body)); return res.status(201).json(await service.copySurvey(id(req, "surveyId"), data.target_cohort_id, data.title)); } catch (e) { return next(e); } }
export async function getPublicForm(req: Request, res: Response, next: NextFunction) { try { return res.json(await service.getPublicFormByInvitationToken(id(req, "token"))); } catch (e) { return next(e); } }

export async function getCohortSurvey(req: Request, res: Response, next: NextFunction) {
  try {
    const survey = await service.getSurveyByCohort(id(req, "cohortId"));
    if (!survey) return next(new AppError("Survey not found", 404, "SURVEY_NOT_FOUND"));
    return res.json(survey);
  } catch (e) { return next(e); }
}

export async function createCohortSurvey(req: Request, res: Response, next: NextFunction) {
  try {
    const data = parse(createSurveySchema.omit({ cohort_id: true }).safeParse(req.body));
    return res.status(201).json(await service.createSurveyForCohort(id(req, "cohortId"), data.title));
  } catch (e) { return next(e); }
}

async function cohortSurveyId(req: Request) {
  const survey = await service.getSurveyByCohort(id(req, "cohortId"));
  if (!survey) throw new AppError("Survey not found", 404, "SURVEY_NOT_FOUND");
  return survey.id;
}

export async function createCohortQuestion(req: Request, res: Response, next: NextFunction) {
  try { return res.status(201).json(await service.createQuestion(await cohortSurveyId(req), parse(createQuestionSchema.safeParse(req.body)))); } catch (e) { return next(e); }
}
export async function updateCohortQuestion(req: Request, res: Response, next: NextFunction) {
  try { return res.json(await service.updateQuestion(await cohortSurveyId(req), id(req, "questionId"), parse(updateQuestionSchema.safeParse(req.body)))); } catch (e) { return next(e); }
}
export async function deleteCohortQuestion(req: Request, res: Response, next: NextFunction) {
  try { await service.deleteQuestion(await cohortSurveyId(req), id(req, "questionId")); return res.status(204).send(); } catch (e) { return next(e); }
}
