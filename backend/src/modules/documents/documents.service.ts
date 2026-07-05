import { prisma } from "../../shared/prisma";
import { UpdateDocumentDto } from "./dto/update-document.dto";
import { UpdateReviewDto } from "./dto/update-review.dto";

export class DocumentsService {
  async ensureApprovedApplication(userId: string, cohortId: string) {
    const application = await prisma.application.findFirst({
      where: {
        user_id: userId,
        cohort_id: cohortId,
        status: "APPROVED",
      },
    });

    if (!application) {
      throw new Error("Application not approved");
    }
  }

  async getByUser(userId: string, cohortId: string) {
    await this.ensureApprovedApplication(userId, cohortId);

    return prisma.studentDocumentData.findUnique({
      where: {
        user_id_cohort_id: {
          user_id: userId,
          cohort_id: cohortId,
        },
      },
    });
  }

  async create(userId: string, cohortId: string) {
    await this.ensureApprovedApplication(userId, cohortId);

    return prisma.studentDocumentData.upsert({
      where: {
        user_id_cohort_id: {
          user_id: userId,
          cohort_id: cohortId,
        },
      },
      update: {},
      create: {
        user_id: userId,
        cohort_id: cohortId,
      },
    });
  }

  async update(userId: string, cohortId: string, data: UpdateDocumentDto) {
    await this.ensureApprovedApplication(userId, cohortId);

    return prisma.studentDocumentData.upsert({
      where: {
        user_id_cohort_id: {
          user_id: userId,
          cohort_id: cohortId,
        },
      },
      update: data,
      create: {
        user_id: userId,
        cohort_id: cohortId,
        ...data,
      },
    });
  }

  async updateReportFile(userId: string, cohortId: string, reportFileUrl: string) {
    await this.ensureApprovedApplication(userId, cohortId);

    return prisma.studentDocumentData.upsert({
      where: {
        user_id_cohort_id: {
          user_id: userId,
          cohort_id: cohortId,
        },
      },
      update: {
        report_file_url: reportFileUrl,
      },
      create: {
        user_id: userId,
        cohort_id: cohortId,
        report_file_url: reportFileUrl,
      },
    });
  }

  async updateReview(userId: string, cohortId: string, data: UpdateReviewDto) {
    return prisma.studentDocumentData.upsert({
      where: {
        user_id_cohort_id: {
          user_id: userId,
          cohort_id: cohortId,
        },
      },
      update: data,
      create: {
        user_id: userId,
        cohort_id: cohortId,
        ...data,
      },
    });
  }

  async approveReport(userId: string, cohortId: string) {
    return prisma.studentDocumentData.updateMany({
      where: {
        user_id: userId,
        cohort_id: cohortId,
      },
      data: {
        report_admin_approved: true,
      },
    });
  }
  async getReadiness(userId: string, cohortId: string) {
    await this.ensureApprovedApplication(userId, cohortId);

    const documents = await prisma.studentDocumentData.findUnique({
      where: {
        user_id_cohort_id: {
          user_id: userId,
          cohort_id: cohortId,
        },
      },
    });

    const missingFields = (fields: string[]) => {
      if (!documents) {
        return fields;
      }

      return fields.filter((field) => {
        const value = documents[field as keyof typeof documents];

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
}