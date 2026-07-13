import { ApplicationStatus, Prisma } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { AppError } from "../../middlewares/error.middleware";
import { DailyTaskCalendarService } from "../tasks/dailyTaskCalendar.service";
import { ApplicationAnswerService } from "./applicationAnswer.service";
import type { CreateApplicationDto, UpdateApplicationStatusDto } from "./dto/application.dto";

const applicationInclude = {
  track: { include: { cohort: true } },
  answers: { include: { question: true }, orderBy: { question: { order_index: "asc" as const } } },
} satisfies Prisma.ApplicationInclude;

export class ApplicationService {
  constructor(
    private readonly calendarService = new DailyTaskCalendarService(),
    private readonly answerService = new ApplicationAnswerService(),
  ) {}

  async submitByInvitation(userId: string, token: string, dto: CreateApplicationDto) {
    const invitation = await prisma.invitation.findUnique({ where: { token }, include: { cohort: { include: { survey: { include: { questions: true } } } } } });
    this.assertInvitationOpen(invitation);
    const track = await prisma.track.findUnique({ where: { id: dto.track_id } });
    if (!track) throw new AppError("Track not found", 404, "TRACK_NOT_FOUND");
    if (track.cohort_id !== invitation!.cohort_id) throw new AppError("Track does not belong to invitation cohort", 400, "TRACK_COHORT_MISMATCH");
    if (!invitation!.cohort.survey) throw new AppError("Survey not found", 404, "SURVEY_NOT_FOUND");
    const questions = invitation!.cohort.survey.questions;
    this.validateAnswers(dto, questions);
    try {
      return await prisma.$transaction(async (tx) => {
        const application = await tx.application.create({ data: { user_id: userId, track_id: dto.track_id, status: ApplicationStatus.PENDING } });
        await this.answerService.createAnswersBulk(tx, application.id, dto.answers);
        return tx.application.findUnique({ where: { id: application.id }, include: applicationInclude });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AppError("Application already exists for this track", 409, "APPLICATION_ALREADY_EXISTS");
      throw error;
    }
  }

  async listMine(userId: string) {
    return prisma.application.findMany({ where: { user_id: userId }, orderBy: { submitted_at: "desc" }, include: applicationInclude });
  }

  async getMine(userId: string, applicationId: string) {
    const application = await prisma.application.findFirst({ where: { id: applicationId, user_id: userId }, include: applicationInclude });
    if (!application) throw new AppError("Application not found", 404, "APPLICATION_NOT_FOUND");
    return application;
  }

  async listForCohort(cohortId: string) {
    return prisma.application.findMany({ where: { track: { cohort_id: cohortId } }, orderBy: { submitted_at: "desc" }, include: { ...applicationInclude, user: { select: { id: true, email: true, full_name: true, created_at: true } } } });
  }

  async getForCohort(cohortId: string, applicationId: string) {
    const application = await prisma.application.findFirst({ where: { id: applicationId, track: { cohort_id: cohortId } }, include: { ...applicationInclude, user: { select: { id: true, email: true, full_name: true, created_at: true } } } });
    if (!application) throw new AppError("Application not found", 404, "APPLICATION_NOT_FOUND");
    return application;
  }

  async updateStatus(cohortId: string, applicationId: string, dto: UpdateApplicationStatusDto) {
    const current = await prisma.application.findFirst({ where: { id: applicationId, track: { cohort_id: cohortId } }, select: { id: true, status: true } });
    if (!current) throw new AppError("Application not found", 404, "APPLICATION_NOT_FOUND");
    if (current.status === ApplicationStatus.APPROVED && dto.status === ApplicationStatus.REJECTED) throw new AppError("Approved application cannot be rejected", 400, "INVALID_STATUS_TRANSITION");
    if (current.status === dto.status) {
      return this.getForCohort(cohortId, applicationId);
    }
    return prisma.$transaction(async (tx) => {
      const updated = await tx.application.update({ where: { id: applicationId }, data: { status: dto.status, rejection_reason: dto.status === ApplicationStatus.REJECTED ? dto.rejection_reason : null } });
      if (current.status !== ApplicationStatus.APPROVED && dto.status === ApplicationStatus.APPROVED) await this.calendarService.ensureForApprovedApplication(applicationId, tx);
      return tx.application.findUnique({ where: { id: updated.id }, include: { ...applicationInclude, user: { select: { id: true, email: true, full_name: true, created_at: true } } } });
    });
  }

  private assertInvitationOpen(invitation: any): asserts invitation {
    if (!invitation) throw new AppError("Invalid invitation token", 400, "INVITATION_NOT_FOUND");
    const now = new Date();
    if (invitation.expires_at <= now) throw new AppError("Invitation has expired", 400, "INVITATION_EXPIRED");
    const { cohort } = invitation;
    if (cohort.status === "CLOSED") throw new AppError("Cohort is closed", 400, "COHORT_CLOSED");
    if (!cohort.application_start || !cohort.application_end || now < cohort.application_start || now > cohort.application_end) throw new AppError("Application window is closed", 400, "APPLICATION_WINDOW_CLOSED");
  }

  private validateAnswers(dto: CreateApplicationDto, questions: Array<{ id: string; label: string; required: boolean }>) {
    if (new Set(dto.answers.map((answer) => answer.question_id)).size !== dto.answers.length) throw new AppError("Duplicate answer", 400, "DUPLICATE_ANSWER");
    const questionIds = new Set(questions.map((question) => question.id));
    if (dto.answers.some((answer) => !questionIds.has(answer.question_id))) throw new AppError("Question does not belong to invitation cohort", 400, "QUESTION_COHORT_MISMATCH");
    const answers = new Map(dto.answers.map((answer) => [answer.question_id, answer.answer_value]));
    const missing = questions.filter((question) => question.required && !answers.get(question.id)?.trim());
    if (missing.length > 0) throw new AppError("Required answer is missing", 400, "REQUIRED_ANSWER_MISSING", missing.map(({ id, label }) => ({ id, label })));
  }
}
