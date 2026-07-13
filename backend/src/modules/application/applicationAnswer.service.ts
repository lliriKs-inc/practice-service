import type { Prisma } from "@prisma/client";
import type { CreateApplicationDto } from "./dto/application.dto";

export class ApplicationAnswerService {
  async createAnswersBulk(tx: Prisma.TransactionClient, applicationId: string, answers: CreateApplicationDto["answers"]) {
    return tx.applicationAnswer.createMany({
      data: answers.map(({ question_id, answer_value }) => ({ application_id: applicationId, question_id, answer_value })),
    });
  }
}
