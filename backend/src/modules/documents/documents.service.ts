import { prisma } from "../../shared/prisma";
import { UpdateDocumentDto } from "./dto/update-document.dto";
import { UpdateReviewDto } from "./dto/update-review.dto";
import { DocumentGeneratorService, DocumentTemplate } from "./documentGenerator.service";
import { AppError } from "../../middlewares/error.middleware";

const generator = new DocumentGeneratorService();

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
      throw new AppError("Application not approved", 403);
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

  async approveReport(userId: string, cohortId: string) {
    await this.ensureApprovedApplication(userId, cohortId);
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

  async generateDocument(userId: string, cohortId: string, type: DocumentTemplate) {
    await this.ensureApprovedApplication(userId, cohortId);

    const documents = await prisma.studentDocumentData.findUnique({
      where: {
        user_id_cohort_id: {
          user_id: userId,
          cohort_id: cohortId,
        },
      },
    });

    if (!documents) {
      throw new AppError("Documents data not found", 404);
    }

    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
    });

    if (!cohort) {
      throw new AppError("Cohort not found", 404);
    }

    const readiness = await this.getReadiness(userId, cohortId);

    if (type === "individual-task" && !readiness.individual_task.ready) {
      throw new AppError("Individual task document is not ready", 400);
    }

    if (type === "review" && !readiness.review.ready) {
      throw new AppError("Review document is not ready", 400);
    }

    if (type === "title-page" && !readiness.title_page.ready) {
      throw new AppError("Title page document is not ready", 400);
    }

    const year = cohort.practice_start.getFullYear();

    return generator.generate(type, {
      student_fio: documents.student_fio,
      group: documents.group,
      direction_code: documents.direction_code,
      direction_name: documents.direction_name,
      program_name: documents.program_name,
      specialty: documents.specialty,
      practice_topic: documents.practice_topic,
      main_stage_tasks: documents.main_stage_tasks,
      practice_start: this.formatDate(cohort.practice_start),
      practice_end: this.formatDate(cohort.practice_end),
      practice_stage1_finish: this.formatDate(this.addDays(cohort.practice_start, 7)),
      practice_stage2_finish: this.formatDate(this.addDays(cohort.practice_start, 23)),
      practice_stage3_start: this.formatDate(this.addDays(cohort.practice_start, 24)),
      review_activities: documents.review_activities,
      review_characteristic: documents.review_characteristic,
      review_employed: documents.review_employed,
      review_next_practice: documents.review_next_practice,
      review_employment_offer: documents.review_employment_offer,
      review_suggestions: documents.review_suggestions,
      review_grade: documents.review_grade,
      year,
    });
  }

  private formatDate(date: Date) {
    return new Intl.DateTimeFormat("ru-RU").format(date);
  }

  private addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

}