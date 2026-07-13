import { CohortStatus } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { AppError } from "../../middlewares/error.middleware";

export class CohortService {
  async createCohort(data: {
    title: string;
    status?: CohortStatus;
    application_start?: Date;
    application_end?: Date;
    practice_start: Date;
    practice_end: Date;
    created_by: string;
  }) {
    if (data.practice_start > data.practice_end) throw new AppError("Practice dates are invalid", 400, "INVALID_DATE_RANGE");
    if (data.application_start && data.application_end && data.application_start > data.application_end) throw new AppError("Application dates are invalid", 400, "INVALID_DATE_RANGE");
    if (data.application_end && data.application_end > data.practice_start) throw new AppError("Application window must end before practice starts", 400, "INVALID_DATE_RANGE");
    if (data.status === CohortStatus.ACTIVE && (!data.application_start || !data.application_end)) throw new AppError("Active cohort requires an application window", 400, "INVALID_COHORT_STATUS");

    return prisma.cohort.create({ data: { title: data.title.trim(), status: data.status ?? CohortStatus.DRAFT, application_start: data.application_start, application_end: data.application_end, practice_start: data.practice_start, practice_end: data.practice_end, created_by: data.created_by } });
  }

  async findCurrentPublicCohort() {
    const now = new Date();
    return prisma.cohort.findFirst({ where: { status: CohortStatus.ACTIVE, application_start: { lte: now }, application_end: { gte: now } } });
  }
}
