import { prisma } from '../../shared/prisma';
import { CreateApplicationDto } from './dto/application.dto';
import { ApplicationAnswerService } from './applicationAnswer.service';

const answerService = new ApplicationAnswerService();

export class ApplicationService {
  async createApplication(userId: string, cohortId: string, dto: CreateApplicationDto) {
    return prisma.$transaction(async (tx) => {
      const application = await tx.application.create({
        data: {
          user_id: userId,
          cohort_id: cohortId,
        },
      });

      await answerService.createAnswersBulk(tx, application.id, dto.answers);

      return tx.application.findUnique({
        where: { id: application.id },
        include: {
          answers: true,
        },
      });
    });
  }

  async getMyApplication(userId: string, cohortId: string) {
    return null; // Будет реализовано в следующей задаче
  }

  async getApplicationById(id: string, cohortId: string) {
    return null; // Будет реализовано далее
  }
}