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
}