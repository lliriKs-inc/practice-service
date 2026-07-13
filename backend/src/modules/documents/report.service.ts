import {
  ApplicationStatus,
  ReportStatus,
} from "@prisma/client";
import { AppError } from "../../middlewares/error.middleware";
import { prisma } from "../../shared/prisma";
import type {
  StorageService,
  SaveFileInput,
} from "../../shared/storage";

export class ReportService {
  constructor(
    private readonly storage: StorageService
  ) {}

  async getMine(
    userId: string,
    applicationId: string
  ) {
    const application =
      await prisma.application.findFirst({
        where: {
          id: applicationId,
          user_id: userId,
          status: ApplicationStatus.APPROVED,
        },
        select: {
          id: true,
          report: true,
        },
      });

    if (!application) {
      throw new AppError(
        "Application not found",
        404,
        "APPLICATION_NOT_FOUND"
      );
    }

    return application.report;
  }

  async replaceMine(
    userId: string,
    applicationId: string,
    file: SaveFileInput
  ) {
    const application =
      await prisma.application.findFirst({
        where: {
          id: applicationId,
          user_id: userId,
          status: ApplicationStatus.APPROVED,
        },
        select: {
          id: true,
          report: true,
        },
      });

    if (!application) {
      throw new AppError(
        "Application not found",
        404,
        "APPLICATION_NOT_FOUND"
      );
    }

    const stored = await this.storage.replace({
      previousKey: application.report?.file_url ?? null,
      file: {
        ...file,
        category: "reports",
      },
    });

    try {
      return await prisma.report.upsert({
        where: {
          application_id: applicationId,
        },
        update: {
          file_url: stored.key,
          status: ReportStatus.PENDING,
          uploaded_at: new Date(),
          reviewed_at: null,
        },
        create: {
          application_id: applicationId,
          file_url: stored.key,
          status: ReportStatus.PENDING,
        },
      });
    } catch (error) {
      await this.storage.remove(stored.key);
      throw error;
    }
  }

  async review(
    adminId: string,
    cohortId: string,
    applicationId: string,
    status: ReportStatus
  ) {
    const application =
      await prisma.application.findFirst({
        where: {
          id: applicationId,
          status: ApplicationStatus.APPROVED,
          track: {
            cohort_id: cohortId,
          },
        },
        select: {
          id: true,
          report: true,
        },
      });

    if (!application) {
      throw new AppError(
        "Application not found",
        404,
        "APPLICATION_NOT_FOUND"
      );
    }

    if (!application.report) {
      throw new AppError(
        "Report not found",
        404,
        "REPORT_NOT_FOUND"
      );
    }

    return prisma.report.update({
      where: {
        application_id: applicationId,
      },
      data: {
        status,
        reviewed_at: new Date(),
      },
    });
  }
}
