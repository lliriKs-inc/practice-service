import { CohortStatus } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { AppError } from "../../middlewares/error.middleware";
import { config } from "../../shared/config";
import { auditLogger, type AuditLogger } from "../../shared/logger";
import {
  LocalStorageService,
  type StorageService,
} from "../../shared/storage";

const cohortInclude = {
  tracks: { include: { testTask: true }, orderBy: { title: "asc" as const } },
  survey: { include: { questions: { orderBy: { order_index: "asc" as const } } } },
  invitation: true,
};

export class CohortService {
  private readonly storage: StorageService;
  private readonly audit: AuditLogger;

  constructor(options: {
    storage?: StorageService;
    audit?: AuditLogger;
  } = {}) {
    this.storage = options.storage ?? new LocalStorageService({
      rootDirectory: config.storage.uploadDir,
    });
    this.audit = options.audit ?? auditLogger;
  }

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

    return prisma.cohort.create({ data: { title: data.title.trim(), status: data.status ?? CohortStatus.DRAFT, application_start: data.application_start, application_end: data.application_end, practice_start: data.practice_start, practice_end: data.practice_end, created_by: data.created_by }, include: cohortInclude });
  }

  async listCohorts() {
    return prisma.cohort.findMany({ include: cohortInclude, orderBy: { created_at: "desc" } });
  }

  async getCohort(id: string) {
    return prisma.cohort.findUnique({ where: { id }, include: cohortInclude });
  }

  async updateCohort(id: string, data: import("./dto/update-cohort.dto").UpdateCohortDto) {
    const current = await this.getCohort(id);
    if (!current) throw new AppError("Cohort not found", 404, "COHORT_NOT_FOUND");
    const applicationStart = data.application_start === undefined ? current.application_start : data.application_start;
    const applicationEnd = data.application_end === undefined ? current.application_end : data.application_end;
    const practiceStart = data.practice_start ?? current.practice_start;
    const practiceEnd = data.practice_end ?? current.practice_end;
    this.validateDates(applicationStart, applicationEnd, practiceStart, practiceEnd);
    return prisma.cohort.update({
      where: { id },
      data: {
        ...(data.title === undefined ? {} : { title: data.title.trim() }),
        ...(data.application_start === undefined ? {} : { application_start: data.application_start }),
        ...(data.application_end === undefined ? {} : { application_end: data.application_end }),
        ...(data.practice_start === undefined ? {} : { practice_start: data.practice_start }),
        ...(data.practice_end === undefined ? {} : { practice_end: data.practice_end }),
      },
      include: cohortInclude,
    });
  }

  async activateCohort(id: string) {
    const cohort = await this.getCohort(id);
    if (!cohort) throw new AppError("Cohort not found", 404, "COHORT_NOT_FOUND");
    if (cohort.status !== CohortStatus.DRAFT) throw new AppError("Only a draft cohort can be activated", 409, "INVALID_COHORT_STATUS");
    if (!cohort.application_start || !cohort.application_end) throw new AppError("Active cohort requires an application window", 400, "INVALID_COHORT_STATUS");
    const active = await prisma.cohort.findFirst({ where: { status: CohortStatus.ACTIVE, id: { not: id } }, select: { id: true } });
    if (active) throw new AppError("Another cohort is already active", 409, "ACTIVE_COHORT_EXISTS");
    return prisma.cohort.update({ where: { id }, data: { status: CohortStatus.ACTIVE }, include: cohortInclude });
  }

  async closeCohort(id: string) {
    const cohort = await this.getCohort(id);
    if (!cohort) throw new AppError("Cohort not found", 404, "COHORT_NOT_FOUND");
    if (cohort.status !== CohortStatus.ACTIVE) throw new AppError("Only an active cohort can be closed", 409, "INVALID_COHORT_STATUS");
    return prisma.cohort.update({ where: { id }, data: { status: CohortStatus.CLOSED }, include: cohortInclude });
  }

  async deleteCohort(
    id: string,
    actorId: string | null = null,
    requestId: string | null = null,
  ) {
    const cohort = await this.getCohort(id);
    if (!cohort) {
      throw new AppError("Cohort not found", 404, "COHORT_NOT_FOUND");
    }
    if (cohort.status !== CohortStatus.DRAFT) {
      throw new AppError(
        "Only a draft cohort can be deleted",
        409,
        "COHORT_NOT_DRAFT",
      );
    }

    const [applications, submissions] = await Promise.all([
      prisma.application.count({
        where: { track: { cohort_id: id } },
      }),
      prisma.testTaskSubmission.count({
        where: { application: { track: { cohort_id: id } } },
      }),
    ]);

    if (applications > 0 || submissions > 0) {
      throw new AppError(
        "A cohort with applications cannot be deleted",
        409,
        "COHORT_HAS_APPLICATIONS",
      );
    }

    const fileKeys = cohort.tracks.flatMap((track) =>
      track.testTask?.file_url ? [track.testTask.file_url] : [],
    );

    await prisma.cohort.delete({ where: { id } });
    const cleanup = await Promise.allSettled(
      fileKeys.map((key) => this.storage.remove(key)),
    );

    this.audit.record({
      action: "COHORT_DELETED",
      outcome: "success",
      actorId,
      requestId,
      resourceType: "cohort",
      resourceId: id,
      metadata: {
        fileCount: fileKeys.length,
        fileCleanupFailures: cleanup.filter(
          ({ status }) => status === "rejected",
        ).length,
      },
    });

    return { deleted: true };
  }

  private validateDates(applicationStart: Date | null, applicationEnd: Date | null, practiceStart: Date, practiceEnd: Date) {
    if (practiceStart > practiceEnd) throw new AppError("Practice dates are invalid", 400, "INVALID_DATE_RANGE");
    if (applicationStart && applicationEnd && applicationStart > applicationEnd) throw new AppError("Application dates are invalid", 400, "INVALID_DATE_RANGE");
    if (applicationEnd && applicationEnd > practiceStart) throw new AppError("Application window must end before practice starts", 400, "INVALID_DATE_RANGE");
  }

  async findCurrentPublicCohort() {
    const now = new Date();
    return prisma.cohort.findFirst({ where: { status: CohortStatus.ACTIVE, application_start: { lte: now }, application_end: { gte: now } } });
  }
}
