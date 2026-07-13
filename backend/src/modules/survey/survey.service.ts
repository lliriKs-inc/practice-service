import { CohortStatus, Prisma } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { AppError } from "../../middlewares/error.middleware";
import type { CreateQuestionDto, CreateSurveyDto, UpdateQuestionDto } from "./dto/survey.dto";

const surveyWithQuestions = { questions: { orderBy: { order_index: "asc" as const } } } satisfies Prisma.SurveyInclude;

export class SurveyService {
  async createSurvey(data: CreateSurveyDto) {
    const cohort = await prisma.cohort.findUnique({ where: { id: data.cohort_id } });
    if (!cohort) throw new AppError("Cohort not found", 404, "COHORT_NOT_FOUND");
    const existing = await prisma.survey.findUnique({ where: { cohort_id: data.cohort_id } });
    if (existing) throw new AppError("Survey already exists for this cohort", 409, "SURVEY_ALREADY_EXISTS");
    return prisma.survey.create({ data: { cohort_id: data.cohort_id, title: data.title.trim() }, include: surveyWithQuestions });
  }

  async getSurvey(surveyId: string) {
    return prisma.survey.findUnique({ where: { id: surveyId }, include: surveyWithQuestions });
  }

  async getQuestions(surveyId: string) {
    await this.requireSurvey(surveyId);
    return prisma.question.findMany({ where: { survey_id: surveyId }, orderBy: { order_index: "asc" } });
  }

  async getQuestion(surveyId: string, questionId: string) {
    return this.requireQuestion(surveyId, questionId);
  }

  async updateSurvey(surveyId: string, title: string) {
    await this.requireSurvey(surveyId);
    return prisma.survey.update({ where: { id: surveyId }, data: { title: title.trim() }, include: surveyWithQuestions });
  }

  async deleteSurvey(surveyId: string) {
    await this.requireSurvey(surveyId);
    return prisma.survey.delete({ where: { id: surveyId } });
  }

  async createQuestion(surveyId: string, data: CreateQuestionDto) {
    await this.requireSurvey(surveyId);
    const orderIndex = data.order_index ?? await this.nextOrderIndex(surveyId);
    return prisma.question.create({
      data: { survey_id: surveyId, label: data.label.trim(), type: data.type, required: data.required, order_index: orderIndex, options: data.options ?? Prisma.JsonNull },
    });
  }

  async updateQuestion(surveyId: string, questionId: string, data: UpdateQuestionDto) {
    await this.requireQuestion(surveyId, questionId);
    return prisma.question.update({
      where: { id: questionId },
      data: { label: data.label?.trim(), type: data.type, required: data.required, order_index: data.order_index, options: data.options === undefined ? undefined : data.options ?? Prisma.JsonNull },
    });
  }

  async deleteQuestion(surveyId: string, questionId: string) {
    await this.requireQuestion(surveyId, questionId);
    return prisma.question.delete({ where: { id: questionId } });
  }

  async reorderQuestions(surveyId: string, questionIds: string[]) {
    await this.requireSurvey(surveyId);
    const questions = await prisma.question.findMany({ where: { survey_id: surveyId }, select: { id: true } });
    if (questions.length !== questionIds.length || new Set(questionIds).size !== questionIds.length || questions.some(({ id }) => !questionIds.includes(id))) {
      throw new AppError("The order must contain every question exactly once", 400, "INVALID_QUESTION_ORDER");
    }
    await prisma.$transaction(questionIds.map((id, index) => prisma.question.update({ where: { id }, data: { order_index: index } })));
    return prisma.question.findMany({ where: { survey_id: surveyId }, orderBy: { order_index: "asc" } });
  }

  async copySurvey(sourceSurveyId: string, targetCohortId: string, title?: string) {
    const source = await prisma.survey.findUnique({ where: { id: sourceSurveyId }, include: { questions: { orderBy: { order_index: "asc" } } } });
    if (!source) throw new AppError("Source survey not found", 404, "SOURCE_SURVEY_NOT_FOUND");
    const cohort = await prisma.cohort.findUnique({ where: { id: targetCohortId } });
    if (!cohort) throw new AppError("Target cohort not found", 404, "TARGET_COHORT_NOT_FOUND");
    if (await prisma.survey.findUnique({ where: { cohort_id: targetCohortId } })) throw new AppError("Target cohort already has a survey", 409, "TARGET_SURVEY_ALREADY_EXISTS");
    return prisma.$transaction(async (tx) => tx.survey.create({
      data: {
        cohort_id: targetCohortId,
        title: title?.trim() || source.title,
        questions: { create: source.questions.map((q) => ({ label: q.label, type: q.type, required: q.required, order_index: q.order_index, options: q.options ?? Prisma.JsonNull })) },
      },
      include: surveyWithQuestions,
    }));
  }

  async getPublicFormByInvitationToken(token: string) {
    const invitation = await prisma.invitation.findUnique({ where: { token }, include: { cohort: { include: { survey: { include: { questions: { orderBy: { order_index: "asc" } } } }, tracks: { orderBy: { title: "asc" } } } } } });
    if (!invitation) throw new AppError("Invalid invitation token", 400, "INVALID_TOKEN");
    const now = new Date();
    if (invitation.expires_at <= now) throw new AppError("Invitation has expired", 400, "TOKEN_EXPIRED");
    if (invitation.cohort.status === CohortStatus.CLOSED || !invitation.cohort.application_start || !invitation.cohort.application_end || now < invitation.cohort.application_start || now > invitation.cohort.application_end) {
      throw new AppError("Application window is closed", 400, "APPLICATION_WINDOW_CLOSED");
    }
    if (!invitation.cohort.survey) throw new AppError("Survey not found", 404, "SURVEY_NOT_FOUND");
    return { cohort: { id: invitation.cohort.id, title: invitation.cohort.title }, tracks: invitation.cohort.tracks.map(({ id, title }) => ({ id, title })), survey: { id: invitation.cohort.survey.id, title: invitation.cohort.survey.title, questions: invitation.cohort.survey.questions.map(({ id, label, type, required, order_index, options }) => ({ id, label, type, required, order_index, options })) } };
  }

  private async requireSurvey(id: string) {
    const survey = await prisma.survey.findUnique({ where: { id } });
    if (!survey) throw new AppError("Survey not found", 404, "SURVEY_NOT_FOUND");
    return survey;
  }
  private async requireQuestion(surveyId: string, questionId: string) {
    const question = await prisma.question.findFirst({ where: { id: questionId, survey_id: surveyId } });
    if (!question) throw new AppError("Question not found", 404, "QUESTION_NOT_FOUND");
    return question;
  }
  private async nextOrderIndex(surveyId: string) {
    const last = await prisma.question.findFirst({ where: { survey_id: surveyId }, orderBy: { order_index: "desc" }, select: { order_index: true } });
    return (last?.order_index ?? -1) + 1;
  }
}
