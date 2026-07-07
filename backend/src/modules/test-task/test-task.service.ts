import { prisma } from '../../shared/prisma'; 
import { CreateTestTaskDto } from './dto/create-test-task.dto';

export class TestTaskService {
  async createTestTask(cohortId: string, dto: CreateTestTaskDto) {
    return prisma.testTask.create({
      data: {
        cohort_id: cohortId,
        content: dto.content,
        published_at: dto.published_at ?? null,
      },
    });
  }
}