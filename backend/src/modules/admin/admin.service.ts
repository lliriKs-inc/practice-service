import {
  ApplicationStatus,
  DocumentType,
  Prisma,
  ReportStatus,
} from "@prisma/client";
import { AppError } from "../../middlewares/error.middleware";
import { prisma } from "../../shared/prisma";
import { buildDocumentReadiness } from "../documents/document-readiness.service";
import type { AdminApplicationsQuery } from "./dto/admin-applications-query.dto";
import type { AdminDocumentsQuery } from "./dto/admin-documents-query.dto";

function utcToday(): Date {
  const now = new Date();

  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    )
  );
}

function adminReportDownloadPath(
  cohortId: string,
  applicationId: string
) {
  return `/cohorts/${cohortId}/admin/applications/${applicationId}/report/file`;
}

function withAdminDocumentDownloadPaths<
  T extends { type: DocumentType; generated: boolean },
>(cohortId: string, applicationId: string, documents: T[]) {
  return documents.map((document) => ({
    ...document,
    downloadPath: document.generated
      ? `/cohorts/${cohortId}/admin/applications/${applicationId}/documents/${document.type}/file`
      : null,
  }));
}

export class AdminService {
  async getApplications(
    cohortId: string,
    filters: AdminApplicationsQuery = {}
  ) {
    await this.assertCohortExists(cohortId);

    const where: Prisma.ApplicationWhereInput = {
      track: {
        cohort_id: cohortId,
        ...(filters.trackId ? { id: filters.trackId } : {}),
      },
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search
        ? {
            user: {
              OR: [
                {
                  full_name: {
                    contains: filters.search,
                    mode: "insensitive",
                  },
                },
                {
                  email: {
                    contains: filters.search,
                    mode: "insensitive",
                  },
                },
              ],
            },
          }
        : {}),
    };

    const applications = await prisma.application.findMany({
      where,
      select: {
        id: true,
        status: true,
        submitted_at: true,
        rejection_reason: true,
        user: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
        track: {
          select: {
            id: true,
            title: true,
          },
        },
        testTaskSubmission: {
          select: {
            id: true,
            file_name: true,
            file_url: true,
            submitted_at: true,
          },
        },
        report: {
          select: {
            status: true,
            rejection_reason: true,
            uploaded_at: true,
            reviewed_at: true,
          },
        },
        dailyTasks: {
          where: {
            task_date: { lte: utcToday() },
            description: null,
          },
          select: { id: true },
        },
      },
      orderBy: [{ submitted_at: "desc" }, { id: "asc" }],
    });

    return applications.map((application) => ({
      applicationId: application.id,
      status: application.status,
      submittedAt: application.submitted_at,
      rejectionReason: application.rejection_reason,
      student: application.user,
      track: application.track,
      testTaskSubmission: application.testTaskSubmission
        ? {
            id: application.testTaskSubmission.id,
            fileName:
              application.testTaskSubmission.file_name ??
              "Файл решения",
            submittedAt:
              application.testTaskSubmission.submitted_at,
            downloadPath:
              "/files/" + application.testTaskSubmission.file_url,
          }
        : null,
      report: application.report
        ? {
            status: application.report.status,
            uploadedAt: application.report.uploaded_at,
            reviewedAt: application.report.reviewed_at,
            downloadPath: adminReportDownloadPath(
              cohortId,
              application.id
            ),
          }
        : null,
      missedDays: application.dailyTasks.length,
    }));
  }

  async getApplication(cohortId: string, applicationId: string) {
    const application = await prisma.application.findFirst({
      where: {
        id: applicationId,
        track: { cohort_id: cohortId },
      },
      select: {
        id: true,
        status: true,
        submitted_at: true,
        rejection_reason: true,
        user: {
          select: {
            id: true,
            full_name: true,
            email: true,
            created_at: true,
          },
        },
        track: {
          select: { id: true, title: true },
        },
        answers: {
          select: {
            id: true,
            answer_value: true,
            question: {
              select: {
                id: true,
                label: true,
                type: true,
                order_index: true,
              },
            },
          },
          orderBy: { question: { order_index: "asc" } },
        },
        testTaskSubmission: {
          select: {
            id: true,
            file_name: true,
            file_url: true,
            submitted_at: true,
          },
        },
        report: {
          select: {
            id: true,
            status: true,
            rejection_reason: true,
            uploaded_at: true,
            reviewed_at: true,
          },
        },
        documents: {
          select: {
            type: true,
            generated_file_url: true,
            generated_at: true,
            fieldValues: {
              select: {
                field_key: true,
                value: true,
                filled_by: true,
              },
              orderBy: { field_key: "asc" },
            },
          },
        },
      },
    });

    if (!application) {
      throw new AppError(
        "Application not found",
        404,
        "APPLICATION_NOT_FOUND"
      );
    }

    return {
      applicationId: application.id,
      status: application.status,
      submittedAt: application.submitted_at,
      rejectionReason: application.rejection_reason,
      student: application.user,
      track: application.track,
      answers: application.answers.map((answer) => ({
        id: answer.id,
        value: answer.answer_value,
        question: answer.question,
      })),
      testTaskSubmission: application.testTaskSubmission
        ? {
            id: application.testTaskSubmission.id,
            fileName:
              application.testTaskSubmission.file_name ??
              "Файл решения",
            submittedAt:
              application.testTaskSubmission.submitted_at,
            downloadPath:
              "/files/" + application.testTaskSubmission.file_url,
          }
        : null,
      report: application.report
        ? {
            id: application.report.id,
            status: application.report.status,
            uploadedAt: application.report.uploaded_at,
            reviewedAt: application.report.reviewed_at,
            downloadPath: adminReportDownloadPath(
              cohortId,
              application.id
            ),
          }
        : null,
      documents: withAdminDocumentDownloadPaths(
        cohortId,
        application.id,
        buildDocumentReadiness(
          application.documents,
          application.report
        )
      ),
    };
  }

  async getDocuments(
    cohortId: string,
    filters: AdminDocumentsQuery = {}
  ) {
    await this.assertCohortExists(cohortId);

    const applications = await prisma.application.findMany({
      where: {
        status: ApplicationStatus.APPROVED,
        track: {
          cohort_id: cohortId,
          ...(filters.trackId ? { id: filters.trackId } : {}),
        },
        ...(filters.studentId
          ? { user_id: filters.studentId }
          : {}),
        ...(filters.search
          ? {
              user: {
                OR: [
                  {
                    full_name: {
                      contains: filters.search,
                      mode: "insensitive",
                    },
                  },
                  {
                    email: {
                      contains: filters.search,
                      mode: "insensitive",
                    },
                  },
                ],
              },
            }
          : {}),
        ...(filters.reportStatus === "MISSING"
          ? { report: { is: null } }
          : filters.reportStatus
            ? { report: { is: { status: filters.reportStatus } } }
            : {}),
      },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
        track: {
          select: { id: true, title: true },
        },
        report: {
          select: {
            id: true,
            status: true,
            rejection_reason: true,
            uploaded_at: true,
            reviewed_at: true,
          },
        },
        documents: {
          select: {
            type: true,
            generated_file_url: true,
            generated_at: true,
            fieldValues: {
              select: {
                field_key: true,
                value: true,
                filled_by: true,
              },
              orderBy: { field_key: "asc" },
            },
          },
          orderBy: { type: "asc" },
        },
      },
      orderBy: [{ user: { full_name: "asc" } }, { id: "asc" }],
    });

    return applications
      .map((application) => {
        const readiness = buildDocumentReadiness(
          application.documents,
          application.report
        );

        return {
          applicationId: application.id,
          student: application.user,
          track: application.track,
          report: application.report
            ? {
                id: application.report.id,
                status: application.report.status,
                rejectionReason: application.report.rejection_reason,
                uploadedAt: application.report.uploaded_at,
                reviewedAt: application.report.reviewed_at,
                downloadPath: adminReportDownloadPath(
                  cohortId,
                  application.id
                ),
              }
            : null,
          documents: withAdminDocumentDownloadPaths(
            cohortId,
            application.id,
            readiness
          ),
        };
      })
      .filter((application) => {
        if (!filters.readiness) {
          return true;
        }

        const documents = filters.documentType
          ? application.documents.filter(
              (document) =>
                document.type === filters.documentType
            )
          : application.documents;
        const ready = documents.every((document) => document.ready);

        return filters.readiness === "READY" ? ready : !ready;
      });
  }

  async getApplicationDocuments(
    cohortId: string,
    applicationId: string
  ) {
    const application = await prisma.application.findFirst({
      where: {
        id: applicationId,
        status: ApplicationStatus.APPROVED,
        track: { cohort_id: cohortId },
      },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
        track: {
          select: { id: true, title: true },
        },
        report: {
          select: {
            id: true,
            status: true,
            uploaded_at: true,
            reviewed_at: true,
          },
        },
        documents: {
          select: {
            type: true,
            generated_file_url: true,
            generated_at: true,
            fieldValues: {
              select: {
                field_key: true,
                value: true,
                filled_by: true,
              },
              orderBy: { field_key: "asc" },
            },
          },
          orderBy: { type: "asc" },
        },
      },
    });

    if (!application) {
      throw new AppError(
        "Approved application not found",
        404,
        "APPLICATION_NOT_FOUND"
      );
    }

    return {
      applicationId: application.id,
      student: application.user,
      track: application.track,
      report: application.report
        ? {
            id: application.report.id,
            status: application.report.status,
            uploadedAt: application.report.uploaded_at,
            reviewedAt: application.report.reviewed_at,
            downloadPath: adminReportDownloadPath(
              cohortId,
              application.id
            ),
          }
        : null,
      documents: withAdminDocumentDownloadPaths(
        cohortId,
        application.id,
        buildDocumentReadiness(
          application.documents,
          application.report
        )
      ),
      fieldValues: application.documents.map((document) => ({
        type: document.type,
        values: document.fieldValues.map((field) => ({
          key: field.field_key,
          value: field.value,
          filledBy: field.filled_by,
        })),
      })),
    };
  }

  async getOverview(cohortId: string) {
    const [applications, documents, totalTasks, missedTasks] =
      await Promise.all([
        this.getApplications(cohortId),
        this.getDocuments(cohortId),
        prisma.dailyTask.count({
          where: {
            application: {
              status: ApplicationStatus.APPROVED,
              track: { cohort_id: cohortId },
            },
          },
        }),
        prisma.dailyTask.count({
          where: {
            task_date: { lte: utcToday() },
            description: null,
            application: {
              status: ApplicationStatus.APPROVED,
              track: { cohort_id: cohortId },
            },
          },
        }),
      ]);

    const applicationStatuses = Object.values(
      ApplicationStatus
    ).reduce<Record<ApplicationStatus, number>>(
      (result, status) => ({
        ...result,
        [status]: applications.filter(
          (application) => application.status === status
        ).length,
      }),
      {
        PENDING: 0,
        APPROVED: 0,
        REJECTED: 0,
      }
    );

    const reportStatuses = Object.values(ReportStatus).reduce<
      Record<ReportStatus | "MISSING", number>
    >(
      (result, status) => ({
        ...result,
        [status]: documents.filter(
          (application) => application.report?.status === status
        ).length,
      }),
      {
        MISSING: documents.filter(
          (application) => !application.report
        ).length,
        PENDING: 0,
        APPROVED: 0,
        REJECTED: 0,
      }
    );

    const documentStatuses = Object.values(DocumentType).map(
      (type) => {
        const states = documents.flatMap((application) =>
          application.documents.filter(
            (document) => document.type === type
          )
        );

        return {
          type,
          ready: states.filter((document) => document.ready).length,
          generated: states.filter(
            (document) => document.generated
          ).length,
          total: states.length,
        };
      }
    );

    return {
      cohortId,
      applications: {
        total: applications.length,
        statuses: applicationStatuses,
      },
      documents: {
        approvedApplications: documents.length,
        reports: reportStatuses,
        types: documentStatuses,
      },
      progress: {
        totalTasks,
        missedTasks,
      },
    };
  }

  private async assertCohortExists(cohortId: string) {
    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
      select: { id: true },
    });

    if (!cohort) {
      throw new AppError(
        "Cohort not found",
        404,
        "COHORT_NOT_FOUND"
      );
    }
  }
}
