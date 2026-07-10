import { prisma } from '../../shared/prisma';
import { AppError } from '../../middlewares/error.middleware';
import { ApplicationAnswerService } from './applicationAnswer.service';
import { CreateApplicationDto, ApproveApplicationDto } from './dto/application.dto';

const answerService = new ApplicationAnswerService();

export class ApplicationService {
  async createOrUpdateApplication(userId: string, cohortId: string, dto: CreateApplicationDto) {
    const existingApplication = await prisma.application.findFirst({
      where: {
        user_id: userId,
        cohort_id: cohortId,
      },
    });

    if (existingApplication?.status === 'APPROVED') {
      const error = new Error('Редактирование одобренной заявки запрещено');
      (error as any).statusCode = 403;
      throw error;
    }

        const surveyFields = await prisma.surveyField.findMany({
      where: { cohort_id: cohortId },
      select: {
        id: true,
        label: true,
        required: true,
      },
    });

    const surveyFieldIds = new Set(surveyFields.map((field) => field.id));

    const invalidAnswers = dto.answers.filter(
      (answer) => !surveyFieldIds.has(answer.field_id)
    );

    if (invalidAnswers.length > 0) {
      throw new AppError(
        'Application contains answers for unknown survey fields',
        400
      );
    }

    const answerByFieldId = new Map(
      dto.answers.map((answer) => [answer.field_id, answer.value])
    );

    const missingRequiredFields = surveyFields.filter((field) => {
      if (!field.required) {
        return false;
      }

      const value = answerByFieldId.get(field.id);
      return value === undefined || value.trim() === '';
    });

    if (missingRequiredFields.length > 0) {
      throw new AppError(
        `Required survey fields are missing: ${missingRequiredFields
          .map((field) => field.label)
          .join(', ')}`,
        400
      );
    }
    
    return prisma.$transaction(async (tx) => {
      let applicationId = existingApplication?.id;

      if (existingApplication) {
        await tx.application.update({
          where: { id: applicationId },
          data: {
            status: 'PENDING',
            review_comment: null,
          },
        });
        await answerService.deleteAnswersByApplicationId(tx, applicationId!);
      } else {
        const newApp = await tx.application.create({
          data: {
            user_id: userId,
            cohort_id: cohortId,
          },
        });
        applicationId = newApp.id;
      }

      await answerService.createAnswersBulk(tx, applicationId!, dto.answers);

      return tx.application.findUnique({
        where: { id: applicationId },
        include: {
          answers: true,
        },
      });
    });
  }

  async getRegistrationForm(userId: string, cohortId: string) {
    const fields = await prisma.surveyField.findMany({
      where: { cohort_id: cohortId },
      orderBy: { order: 'asc' },
    });

    const application = await prisma.application.findFirst({
      where: {
        user_id: userId,
        cohort_id: cohortId,
      },
      include: {
        answers: true,
      },
    });

    const fieldsWithAnswers = fields.map(field => {
      const savedAnswer = application?.answers.find(ans => ans.field_id === field.id);
      return {
        id: field.id,
        label: field.label,
        type: field.type,
        required: field.required,
        options: field.options,
        order: field.order,
        existingAnswer: savedAnswer ? savedAnswer.value : null,
      };
    });

    return {
      application_id: application?.id || null,
      status: application?.status || null,
      review_comment: application?.review_comment || null,
      fields: fieldsWithAnswers,
    };
  }

  async getMyApplication(userId: string, cohortId: string) {
    return prisma.application.findUnique({
      where: {
        user_id_cohort_id: {
          user_id: userId,
          cohort_id: cohortId,
        },
      },
      include: {
        role: true,
        answers: {
          include: {
            field: true,
          },
        },
      },
    });
  }

  async getApplicationById(id: string, cohortId: string) {
    return prisma.application.findFirst({
      where: {
        id: id,
        cohort_id: cohortId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            created_at: true,
          },
        },
        answers: {
          include: {
            field: true,
          },
        },
      },
    });
  }
  
  async approveApplication(id: string, cohortId: string, dto: ApproveApplicationDto) {
    const application = await prisma.application.findFirst({
      where: {
        id,
        cohort_id: cohortId,
      },
    });

    if (!application) {
      return null;
    }

    const role = await prisma.cohortRole.findFirst({
      where: {
        id: dto.role_id,
        cohort_id: cohortId,
      },
    });

    if (!role) {
      const error = new Error('Роль не найдена в активной когорте');
      (error as any).statusCode = 400;
      throw error;
    }

    return prisma.application.update({
      where: { id },
      data: {
        status: 'APPROVED',
        role_id: dto.role_id,
        review_comment: null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            created_at: true,
          },
        },
        role: true,
        answers: {
          include: {
            field: true,
          },
        },
      },
    });
  }
}