import { prisma } from "../../shared/prisma";
import { CohortStatus } from "@prisma/client";

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
    return prisma.cohort.create({
      data: {
        title: data.title,
        status: data.status ?? CohortStatus.DRAFT,
        application_start: data.application_start,
        application_end: data.application_end,
        practice_start: data.practice_start,
        practice_end: data.practice_end,
        created_by: data.created_by,
      },
    });
  }

  async findCurrentPublicCohort() {
    const now = new Date();
    return prisma.cohort.findFirst({
      where: {
        status: CohortStatus.ACTIVE,
        application_start: { lte: now },
        application_end: { gte: now },
      },
    });
  }
}