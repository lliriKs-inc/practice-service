import { prisma } from "../../shared/prisma";
import { AppError } from "../../middlewares/error.middleware";

export class AdminService {
  async getApprovedStudents(cohortId: string) {
    return prisma.application.findMany({
      where: {
        cohort_id: cohortId,
        status: "APPROVED",
      },
      select: {
        id: true,
        status: true,
        created_at: true,
        review_comment: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
          },
        },
        user_id: true,
        cohort_id: true,
        role_id: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });
  }

  async getDocuments(cohortId: string) {
    const applications = await prisma.application.findMany({
      where: {
        cohort_id: cohortId,
        status: "APPROVED",
      },
      select: {
        id: true,
        user_id: true,
        role: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            studentDocumentDatas: {
              where: {
                cohort_id: cohortId,
              },
              take: 1,
            },
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return applications.map((application) => {
      const documents = application.user.studentDocumentDatas[0] ?? null;

      return {
        application_id: application.id,
        user_id: application.user_id,
        user: {
          id: application.user.id,
          email: application.user.email,
        },
        role: application.role,
        documents,
        readiness: this.getDocumentReadiness(
          documents as Record<string, unknown> | null
        ),
      };
    });
  }

  private getDocumentReadiness(documents: Record<string, unknown> | null) {
    const missingFields = (fields: string[]) => {
      if (!documents) {
        return fields;
      }

      return fields.filter((field) => {
        const value = documents[field];

        return value === null || value === undefined || value === "";
      });
    };

    const individualTaskFields = [
      "student_fio",
      "group",
      "direction_code",
      "direction_name",
      "program_name",
      "practice_topic",
      "main_stage_tasks",
    ];

    const reviewFields = [
      "student_fio",
      "group",
      "review_activities",
      "review_characteristic",
      "review_employed",
      "review_next_practice",
      "review_employment_offer",
      "review_suggestions",
      "review_grade",
    ];

    const titlePageFields = [
      "student_fio",
      "group",
      "specialty",
      "practice_topic",
      "report_file_url",
    ];

    const individualTaskMissing = missingFields(individualTaskFields);
    const reviewMissing = missingFields(reviewFields);
    const titlePageMissing = missingFields(titlePageFields);

    if (!documents?.report_admin_approved) {
      titlePageMissing.push("report_admin_approved");
    }

    return {
      individual_task: {
        ready: individualTaskMissing.length === 0,
        missingFields: individualTaskMissing,
      },
      review: {
        ready: reviewMissing.length === 0,
        missingFields: reviewMissing,
      },
      title_page: {
        ready: titlePageMissing.length === 0,
        missingFields: titlePageMissing,
      },
    };
  }

  async getStudentDocuments(cohortId: string, userId: string) {
    const application = await prisma.application.findFirst({
      where: {
        cohort_id: cohortId,
        user_id: userId,
        status: "APPROVED",
      },
      select: {
        id: true,
        user_id: true,
        role: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!application) {
      throw new AppError("Approved student not found", 404);
    }

    const documents = await prisma.studentDocumentData.findUnique({
      where: {
        user_id_cohort_id: {
          user_id: userId,
          cohort_id: cohortId,
        },
      },
    });

    return {
      application_id: application.id,
      user_id: application.user_id,
      user: application.user,
      role: application.role,
      documents,
      readiness: this.getDocumentReadiness(
        documents as Record<string, unknown> | null
      ),
    };
  }
}