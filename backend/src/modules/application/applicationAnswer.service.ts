import { prisma } from '../../shared/prisma';
import { CreateApplicationAnswerSchema } from './dto/application.dto';
import { z } from 'zod';

type AnswerInput = z.infer<typeof CreateApplicationAnswerSchema>;

export class ApplicationAnswerService {
  async createAnswersBulk(tx: any, applicationId: string, answers: AnswerInput[]) {
    const answerData = answers.map(ans => ({
      application_id: applicationId,
      field_id: ans.field_id,
      value: ans.value,
    }));

    return tx.applicationAnswer.createMany({
      data: answerData,
    });
  }

  async deleteAnswersByApplicationId(tx: any, applicationId: string) {
    return tx.applicationAnswer.deleteMany({
      where: {
        application_id: applicationId,
      },
    });
  }
}